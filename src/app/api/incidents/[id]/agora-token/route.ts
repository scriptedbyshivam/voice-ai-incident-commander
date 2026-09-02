import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agoraService, AGORA_AGENT_UID } from '@/services/agora';

const TokenRequestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  role: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Allocate a fresh, collision-resistant AI participant uid for every join
 * request. A fixed uid (like the old 1001) collides when the cloud agent or
 * another client already occupies that uid in the channel, surfacing as an
 * Agora `UID_CONFLICT` on the voice room. Randomizing below the string-uid
 * range avoids that without needing to reserve a uid per incident.
 */
function nextAIParticipantUid(): number {
  // 1_000_000..2_000_000 — a sparse, high range that never overlaps the
  // shared agent uid (AGORA_AGENT_UID) or typical browser/operator uids.
  return 1_000_000 + Math.floor(Math.random() * 1_000_000);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json().catch(() => ({}));
    const validated = TokenRequestSchema.parse(body);

    const uid = validated.role ? `${validated.name}|${validated.role}` : validated.name;

    // Allocate a unique AI voice uid for this session (see nextAIParticipantUid).
    const aiUid = nextAIParticipantUid();

    if (!agoraService.isConfigured()) {
      return NextResponse.json({
        appId: '',
        channelName: incidentId,
        token: '',
        uid,
        aiToken: '',
        aiUid,
        agentUid: AGORA_AGENT_UID,
        commanderRtmUid: '',
        commanderRtmToken: '',
        mock: true,
      });
    }

    // User token (combined RTC+RTM) for the string uid
    const token = await agoraService.generateRtcRtmToken(incidentId, uid);

    // AI participant needs its own token for its unique numeric uid.
    const aiToken = await agoraService.generateRtcToken(incidentId, aiUid, 'publisher');

    // The Commander's RTM login gets its own collision-free uid + dedicated
    // token. Reusing the requester uid for RTM collides with a previous (stale,
    // server-side) RTM session on reload/reconnect, throwing -10027.
    const commanderRtmUid = `${uid}~${Date.now()}`;
    const commanderRtmToken = await agoraService.generateRtmToken(incidentId, commanderRtmUid);

    return NextResponse.json({
      appId: agoraService.appId,
      channelName: incidentId,
      token,
      uid,
      aiToken,
      aiUid,
      commanderRtmUid,
      commanderRtmToken,
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
