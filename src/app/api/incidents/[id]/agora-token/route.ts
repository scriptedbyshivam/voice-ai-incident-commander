import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agoraService, AGORA_AGENT_UID } from '@/services/agora';

const TokenRequestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  role: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Stable AI participant uid — must match AI_PARTICIPANT_UID in agoraAIVoiceParticipant.ts */
const AI_PARTICIPANT_UID = 1001;

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json().catch(() => ({}));
    const validated = TokenRequestSchema.parse(body);

    const uid = validated.role ? `${validated.name}|${validated.role}` : validated.name;

    if (!agoraService.isConfigured()) {
      return NextResponse.json({
        appId: '',
        channelName: incidentId,
        token: '',
        uid,
        aiToken: '',
        agentUid: AGORA_AGENT_UID,
        mock: true,
      });
    }

    // User token (combined RTC+RTM) for the string uid
    const token = await agoraService.generateRtcRtmToken(incidentId, uid);

    // AI participant needs its own token for its numeric uid (1001)
    const aiToken = await agoraService.generateRtcToken(incidentId, AI_PARTICIPANT_UID, 'publisher');

    return NextResponse.json({
      appId: agoraService.appId,
      channelName: incidentId,
      token,
      uid,
      aiToken,
      agentUid: AGORA_AGENT_UID,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to generate Agora token' },
      { status: 500 }
    );
  }
}
