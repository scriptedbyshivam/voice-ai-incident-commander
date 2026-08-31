export interface TranscriptionSegment {
  text: string;
  speakerId: string;
  speakerName: string;
  speakerRole?: string;
  timestamp: string;
  isFinal: boolean;
  confidence?: number;
  startTime?: number;
  endTime?: number;
}

export interface RealtimeTranscriptMessage {
  type: 'connected' | 'transcript.partial' | 'transcript.final' | 'transcript.error';
  clientId?: string;
  transcript?: TranscriptionSegment;
  error?: string;
  recoverable?: boolean;
}

export class TranscriptionService {
  private apiKey: string;
  private wsUrl = process.env.TRANSCRIPTION_WS_URL || 'ws://localhost:3001';

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || 'mock_deepgram_key';
  }

  /**
   * Returns the fallback WebSocket URL used for browser fallback streaming.
   * Kept for compatibility.
   */
  async getEphemeralToken(): Promise<{ apiKey: string; url: string }> {
    if (!this.apiKey || this.apiKey === 'mock_deepgram_key') {
      return {
        apiKey: 'mock_client_key',
        url: 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000',
      };
    }

    return {
      apiKey: this.apiKey,
      url: 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&smart_format=true&diarize=true&model=nova-3',
    };
  }

  get transcriptionWsUrl(): string {
    return this.wsUrl;
  }

  /**
   * Builds the transcription WebSocket URL for a given incident + identity.
   */
  clientTranscriptionUrl(opts: {
    incidentId: string;
    userName: string;
    userRole: string;
  }): string {
    const params = new URLSearchParams({
      incidentId: opts.incidentId,
      userName: opts.userName,
      userRole: opts.userRole,
    });
    return `${this.wsUrl}?${params.toString()}`;
  }

  /**
   * Mock transcript parsing for local testing without live audio streams
   */
  async processSimulatedUtterance(
    text: string,
    speakerName: string,
    opts?: { speakerRole?: string; confidence?: number; isFinal?: boolean }
  ): Promise<TranscriptionSegment> {
    return {
      text,
      speakerId: speakerName.toLowerCase(),
      speakerName,
      speakerRole: opts?.speakerRole,
      timestamp: new Date().toISOString(),
      isFinal: opts?.isFinal ?? true,
      confidence: opts?.confidence ?? 1.0,
    };
  }
}

export const transcriptionService = new TranscriptionService();
