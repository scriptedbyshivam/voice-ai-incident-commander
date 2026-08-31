import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import prisma from '../lib/db';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const WS_PORT = parseInt(process.env.TRANSCRIPTION_WS_PORT || '3001', 10);

interface ClientConnection {
  id: string;
  ws: WebSocket;
  incidentId: string;
  userName: string;
  userRole: string;
  deepgramSocket: WebSocket | null;
  connectedAt: Date;
}

const clients = new Map<string, ClientConnection>();
let clientCounter = 0;

function deepgramWsUrl(): string {
  const params = new URLSearchParams({
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    model: 'nova-3',
    smart_format: 'true',
    diarize: 'true',
    punctuate: 'true',
    interim_results: 'true',
    endpointing: '300',
    utterance_end_ms: '1000',
    language: 'en',
    keywords: 'payment API:2,PostgreSQL:2,database:2,Kubernetes:2,deployment:2,rollback:2,latency:2,error rate:2,PagerDuty:2,Jira:2,Slack:2,SEV1:2,SEV2:2,incident commander:2',
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

function connectToDeepgram(client: ClientConnection): void {
  if (!DEEPGRAM_API_KEY || DEEPGRAM_API_KEY === 'placeholder_key' || DEEPGRAM_API_KEY === 'mock_deepgram_key') {
    console.log(`[STT] Mock mode - simulating transcriptions for ${client.userName}`);
    simulateTranscription(client);
    return;
  }

  const url = deepgramWsUrl();
  const dgSocket = new WebSocket(url, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  });

  client.deepgramSocket = dgSocket;

  const keepAlive = setInterval(() => {
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  }, 10_000);

  dgSocket.on('open', () => {
    console.log(`[STT] Deepgram connected for ${client.userName} (${client.id})`);
  });

  dgSocket.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleDeepgramMessage(client, msg);
    } catch {
      // Ignore unparseable Deepgram frames
    }
  });

  dgSocket.on('error', (err: Error) => {
    console.error(`[STT] Deepgram error for ${client.userName}:`, err.message);
    sendToClient(client, {
      type: 'transcript.error',
      error: 'STT connection error - transcription temporarily unavailable',
      recoverable: true,
    });
  });

  dgSocket.on('close', (code: number, reason: Buffer) => {
    clearInterval(keepAlive);
    console.log(`[STT] Deepgram disconnected for ${client.userName}: ${code} ${reason.toString()}`);
    client.deepgramSocket = null;
  });
}

function handleDeepgramMessage(client: ClientConnection, msg: any): void {
  const alternatives = msg?.channel?.alternatives;
  if (!alternatives || alternatives.length === 0) return;

  const transcript = alternatives[0]?.transcript;
  if (!transcript || transcript.trim().length === 0) return;

  const confidence = alternatives[0]?.confidence ?? 0;
  const words = alternatives[0]?.words ?? [];

  const startTime = words.length > 0 ? words[0].start : 0;
  const endTime = words.length > 0 ? words[words.length - 1].end : 0;

  const base = {
    speakerName: client.userName,
    speakerId: client.id,
    speakerRole: client.userRole,
    text: transcript,
    startTime,
    endTime,
    confidence,
  };

  if (msg.is_final) {
    const payload = { ...base, isFinal: true, incidentId: client.incidentId };

    console.log(`[STT] FINAL [${client.userName}]: ${transcript}`);

    persistTranscript(payload).catch((err) =>
      console.error(`[STT] Failed to persist transcript:`, err.message)
    );

    broadcastToIncident(client.incidentId, {
      type: 'transcript.final',
      transcript: {
        id: `transcript-${Date.now()}-${clientCounter++}`,
        ...payload,
        timestamp: new Date().toISOString(),
      },
    });
  } else if (confidence > 0.3) {
    broadcastToIncident(client.incidentId, {
      type: 'transcript.partial',
      transcript: {
        id: `partial-${Date.now()}-${clientCounter++}`,
        ...base,
        isFinal: false,
        incidentId: client.incidentId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

async function persistTranscript(data: {
  incidentId: string;
  speakerName: string;
  speakerId: string;
  speakerRole: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}): Promise<void> {
  let participantId: string | null = null;
  try {
    const participant = await prisma.participant.findFirst({
      where: {
        incidentId: data.incidentId,
        user: { name: data.speakerName },
      },
    });
    if (participant) participantId = participant.id;
  } catch {
    // Participant lookup is best-effort
  }

  await prisma.transcript.create({
    data: {
      incidentId: data.incidentId,
      participantId,
      speakerId: data.speakerId,
      speakerName: data.speakerName,
      speakerRole: data.speakerRole,
      text: data.text,
      confidence: data.confidence,
      isFinal: true,
    },
  });

  // Trigger the AI incident analysis engine (best-effort, non-blocking).
  if (process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_ORIGIN || process.env.NEXT_INTERNAL_URL) {
    triggerAnalysis({
      incidentId: data.incidentId,
      transcript: data.text,
      speakerName: data.speakerName,
      speakerRole: data.speakerRole,
      speakerId: data.speakerId,
    });
  } else {
    console.log('[STT] Analysis skipped (no Next.js base URL configured). Set NEXT_PUBLIC_BASE_URL to enable.');
  }
}

async function triggerAnalysis(input: {
  incidentId: string;
  transcript: string;
  speakerName?: string;
  speakerRole?: string;
  speakerId?: string;
}): Promise<void> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_ORIGIN || process.env.NEXT_INTERNAL_URL;
  if (!base) return;

  try {
    await fetch(`${base}/api/incidents/${encodeURIComponent(input.incidentId)}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: input.transcript,
        speakerName: input.speakerName,
        speakerRole: input.speakerRole,
        speakerId: input.speakerId,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.warn('[STT] Analysis request failed (non-fatal):', (err as Error).message);
  }
}

function broadcastToIncident(incidentId: string, message: object): void {
  const dead: string[] = [];
  clients.forEach((conn, id) => {
    if (conn.incidentId !== incidentId) return;
    if (conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(JSON.stringify(message));
      } catch {
        dead.push(id);
      }
    } else {
      dead.push(id);
    }
  });
  dead.forEach((id) => clients.delete(id));
}

function sendToClient(client: ClientConnection, message: object): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    try {
      client.ws.send(JSON.stringify(message));
    } catch {
      // Client write failure is non-fatal
    }
  }
}

function simulateTranscription(client: ClientConnection): void {
  const queue = [
    { text: 'Payment failures have increased to forty two percent.', delay: 4000 },
    { text: 'Database latency is high.', delay: 6000 },
  ];

  let elapsed = 0;
  queue.forEach(({ text, delay }) => {
    elapsed += delay;

    setTimeout(() => {
      const partialWords = text.split(' ');
      partialWords.forEach((_, i) => {
        setTimeout(() => {
          if (client.ws.readyState !== WebSocket.OPEN) return;
          sendToClient(client, {
            type: 'transcript.partial',
            transcript: {
              id: `partial-sim-${Date.now()}-${i}`,
              speakerName: client.userName,
              speakerId: client.id,
              speakerRole: client.userRole,
              text: partialWords.slice(0, i + 1).join(' '),
              isFinal: false,
              incidentId: client.incidentId,
              confidence: 0.5 + Math.random() * 0.4,
              timestamp: new Date().toISOString(),
              startTime: 0,
              endTime: i * 0.5,
            },
          });
        }, i * 300);
      });

      setTimeout(() => {
        const finalPayload = {
          id: `transcript-sim-${Date.now()}`,
          speakerName: client.userName,
          speakerId: client.id,
          speakerRole: client.userRole,
          text,
          isFinal: true,
          incidentId: client.incidentId,
          confidence: 0.95,
          timestamp: new Date().toISOString(),
          startTime: 0,
          endTime: text.split(' ').length * 0.5,
        };

        broadcastToIncident(client.incidentId, {
          type: 'transcript.final',
          transcript: finalPayload,
        });

        persistTranscript({
          incidentId: client.incidentId,
          speakerName: client.userName,
          speakerId: client.id,
          speakerRole: client.userRole,
          text,
          startTime: 0,
          endTime: text.split(' ').length * 0.5,
          confidence: 0.95,
        }).catch((err) => console.error('[STT] Mock persist error:', err.message));
      }, partialWords.length * 300 + 200);
    }, elapsed);
  });
}

function cleanupClient(clientId: string): void {
  const conn = clients.get(clientId);
  if (!conn) return;

  if (conn.deepgramSocket) {
    try {
      conn.deepgramSocket.close();
    } catch {
      // Ignore close errors
    }
  }

  clients.delete(clientId);
  console.log(`[STT] Client disconnected: ${conn.userName} (${clientId}). Active: ${clients.size}`);
}

// ─── HTTP + WebSocket Server ────────────────────────────────────────────────

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    activeConnections: clients.size,
    uptime: process.uptime(),
  }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '/', `http://localhost:${WS_PORT}`);
  const incidentId = url.searchParams.get('incidentId');
  const userName = url.searchParams.get('userName');
  const userRole = url.searchParams.get('userRole') || 'ENGINEER';

  if (!incidentId || !userName) {
    ws.close(4000, 'Missing incidentId or userName');
    return;
  }

  const clientId = `client-${Date.now()}-${++clientCounter}`;
  const client: ClientConnection = {
    id: clientId,
    ws,
    incidentId,
    userName,
    userRole,
    deepgramSocket: null,
    connectedAt: new Date(),
  };

  clients.set(clientId, client);
  console.log(`[STT] Client connected: ${userName} (${clientId}) → incident ${incidentId}. Active: ${clients.size}`);

  sendToClient(client, { type: 'connected', clientId });

  connectToDeepgram(client);

  ws.on('message', (data: Buffer) => {
    // Audio data from client
    if (client.deepgramSocket && client.deepgramSocket.readyState === WebSocket.OPEN) {
      client.deepgramSocket.send(data);
    }
  });

  ws.on('close', () => cleanupClient(clientId));

  ws.on('error', (err: Error) => {
    console.error(`[STT] Client WS error (${userName}):`, err.message);
    cleanupClient(clientId);
  });
});

wss.on('error', (err: Error) => {
  console.error('[STT] WebSocketServer error:', err.message);
});

server.listen(WS_PORT, () => {
  console.log(`[STT] Transcription WebSocket server listening on ws://localhost:${WS_PORT}`);
  console.log(`[STT] Deepgram key: ${DEEPGRAM_API_KEY && DEEPGRAM_API_KEY !== 'placeholder_key' ? 'configured' : 'MOCK MODE'}`);
});

process.on('SIGINT', () => {
  console.log('\n[STT] Shutting down transcription server...');
  clients.forEach((_, id) => cleanupClient(id));
  wss.close();
  prisma.$disconnect().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  clients.forEach((_, id) => cleanupClient(id));
  wss.close();
  prisma.$disconnect().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
});
