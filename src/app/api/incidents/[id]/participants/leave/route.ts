import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { participantService } from '@/services/participant';

const LeaveBridgeSchema = z.object({
  userId: z.string().uuid('Invalid User ID format'),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json();
    const validated = LeaveBridgeSchema.parse(body);

    const updated = await participantService.removeParticipant(
      incidentId,
      validated.userId
    );

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to record participant departure', details: error.message },
      { status: 500 }
    );
  }
}
