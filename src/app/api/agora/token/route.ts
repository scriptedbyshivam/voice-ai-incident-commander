import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agoraService } from '@/services/agora';

const TokenQuerySchema = z.object({
  incidentId: z.string().min(1, 'incidentId is required').optional(),
  userId: z.string().min(1, 'userId is required'),
  channelName: z.string().min(1, 'channelName is required'),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = {
      incidentId: searchParams.get('incidentId') || undefined,
      userId: searchParams.get('userId') || '',
      channelName: searchParams.get('channelName') || '',
    };

    const validated = TokenQuerySchema.parse(query);

    const config = await agoraService.getRoomConfig(validated.channelName, validated.userId);

    return NextResponse.json(config);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to generate token', details: error.message },
      { status: 500 }
    );
  }
}
