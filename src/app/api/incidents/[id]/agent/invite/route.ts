import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AgoraClient, Agent, DeepgramSTT, ExpiresIn, MiniMaxTTS, OpenAI } from 'agora-agents';
import { agoraService, AGORA_AGENT_UID, agoraAreaToAgentsArea } from '@/services/agora';
import { incidentStateAggregationService } from '@/services/aggregation';

// Route Handlers default to the Node.js runtime; be explicit since the Agora
// Agents SDK is a Node-only library.
export const runtime = 'nodejs';

const InviteAgentSchema = z.object({
  requester_id: z.string().min(1, 'requester_id is required'),
  channel_name: z.string().min(1, 'channel_name is required'),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Summarize the current incident for the Commander's context window. */
async function buildIncidentContext(incidentId: string): Promise<string> {
  try {
    const state = await incidentStateAggregationService.getIncidentState(incidentId);
    if (!state) return '';
    const facts = [...state.confirmedFacts, ...state.reportedObservations]
      .slice(0, 6)
      .map((f) => `- ${f.title} (${f.status})`)
      .join('\n');
    const approvals = (state.approvals || [])
      .filter((a) => a.status === 'PENDING')
      .slice(0, 5)
      .map((a) => `- "${a.actionTitle}" requires human approval`)
      .join('\n');
    const segments = [
      `Incident: ${state.title}`,
      `Severity: ${state.severity} | Status: ${state.currentStatus}`,
      facts ? `Verified facts:\n${facts}` : '',
      approvals ? `Pending human approvals:\n${approvals}` : '',
    ].filter(Boolean);
    return segments.join('\n');
  } catch {
    return '';
  }
}

function commanderPrompt(context: string): string {
  return `You are the **AI Incident Commander** for Agora Command, the real-time incident command system. Human responders are speaking to you over a live voice bridge during an active outage.

# Current incident context
${context || 'No incident summary available (the incident may have no observed facts yet).'}

# Rules of the bridge
- You run a real-time voice conversation. Keep replies to 1-3 sentences. Never enumerate bullet points.
- Be decisive, technical, and calm. You coordinate responders, surface facts, and recommend next step.
- You NEVER execute disruptive production actions autonomously. If a human orders a rollback, restart, destructive change, or a force failover, instruct them that the action must be routed through the human approval workflow in the command hub before it can run.
- Ask at most one focused question per turn. If information is missing, ask for the single most useful piece.
- Stay honest: if you don't know, say so and propose how to find out. Do not invent metrics or root causes.`;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json().catch(() => ({}));
    const validated = InviteAgentSchema.parse(body);

    if (!agoraService.isConfigured()) {
      return NextResponse.json(
        { error: 'Agora is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.' },
        { status: 400 }
      );
    }

    const context = await buildIncidentContext(incidentId);
    const greeting = `This is the AI Incident Commander. Bridge is live. What do we know about the incident?`;

    const client = new AgoraClient({
      area: agoraAreaToAgentsArea(),
      appId: agoraService.appId,
      appCertificate: agoraService.appCertificate,
    });

    // Pipeline: Agora-managed reseller STT (Deepgram) → LLM (OpenAI) → TTS (MiniMax).
    // No vendor API keys required — the whole STT/LLM/TTS pipeline is billed via the
    // Agora project (same as the official quickstart template), so no extra keys/wallets.
    const agent = new Agent({
      client,
      instructions: commanderPrompt(context),
      greeting: greeting,
      failureMessage: 'Signal interrupted, one moment.',
      maxHistory: 50,
      turnDetection: {
        config: {
          speech_threshold: 0.5,
          start_of_speech: {
            mode: 'vad',
            vad_config: {
              interrupt_duration_ms: 160,
              prefix_padding_ms: 300,
            },
          },
          end_of_speech: {
            mode: 'vad',
            vad_config: {
              silence_duration_ms: 480,
            },
          },
        },
      },
      // RTM must be enabled so the browser can receive transcript + state events.
      advancedFeatures: { enable_rtm: true, enable_tools: true },
      parameters: {
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    })
      .withStt(new DeepgramSTT({ model: 'nova-3', language: 'en' }))
      .withLlm(
        new OpenAI({
          model: 'gpt-4o-mini',
          greetingMessage: greeting,
          failureMessage: 'Signal interrupted, one moment.',
          maxHistory: 30,
          params: {
            temperature: 0.6,
            max_tokens: 512,
            top_p: 0.9,
          },
        })
      )
      // TTS in reseller mode (no vendor API key) → billed via the Agora project,
      // matching the official quickstart template's MiniMax preset.
      .withTts(
        new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId: 'English_captivating_female1',
        })
      );

    // remoteUids restricts the agent to process audio only from the requester.
    const session = agent.createSession({
      channel: validated.channel_name,
      agentUid: String(AGORA_AGENT_UID),
      remoteUids: [validated.requester_id],
      enableStringUid: true,
      idleTimeout: 120,
      expiresIn: ExpiresIn.hours(1),
      debug: process.env.NODE_ENV !== 'production',
    });

    const agentId = await session.start();

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      agent_uid: AGORA_AGENT_UID,
      state: 'RUNNING',
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    console.error('[AgentInvite] failed to start commander:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start Conversational AI agent',
      },
      { status: 500 }
    );
  }
}