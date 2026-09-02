import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AgoraClient } from 'agora-agents';
import { agoraService, agoraAreaToAgentsArea } from '@/services/agora';

// The Agora Agents SDK is Node-only; run this route in the Node.js runtime.
export const runtime = 'nodejs';

const StopAgentSchema = z.object({
  agent_id: z.string().min(1, 'agent_id is required'),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await params;
    const body = await req.json().catch(() => ({}));
    const validated = StopAgentSchema.parse(body);

    if (!agoraService.isConfigured()) {
      return NextResponse.json(
        { error: 'Agora is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.' },
        { status: 400 }
      );
    }

    const client = new AgoraClient({
      area: agoraAreaToAgentsArea(),
      appId: agoraService.appId,
      appCertificate: agoraService.appCertificate,
    });

    await client.stopAgent(validated.agent_id);

    return NextResponse.json({ agent_id: validated.agent_id, state: 'STOPPED' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }

    // Stopping is idempotent: the engine returns a 404 or an "already shutting
    // down" message when the agent is already gone — treat those as success.
    const message = error instanceof Error ? error.message : '';
    const alreadyStopped =
      /404|not found|already in the process of shutting down|not exist/i.test(message);
    if (alreadyStopped) {
      return NextResponse.json({
        agent_id: null,
        state: 'STOPPED',
        already: true,
      });
    }

    console.error('[AgentStop] failed to stop agent:', error);
    return NextResponse.json(
      { error: message || 'Failed to stop Conversational AI agent' },
      { status: 500 }
    );
  }
}