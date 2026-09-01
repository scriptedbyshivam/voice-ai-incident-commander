import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agoraService } from '@/services/agora';

const TokenRequestSchema = z.object({
  name: z.string().min(1, 'name is required'),
  role: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

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
        mock: true,
      });
    }

    const config = await agoraService.getRoomConfig(incidentId, uid);

    return NextResponse.json(config);
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
