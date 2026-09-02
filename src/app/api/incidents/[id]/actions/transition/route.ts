import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { actionTrackingService } from '@/services/actionTracking';

const TransitionSchema = z.object({
  actionId: z.string().uuid(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']),
  changedBy: z.string().min(1),
  notes: z.string().optional(),
});

// POST /api/incidents/:id/actions/transition — Execute state machine transition
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = TransitionSchema.parse(body);

    const result = await actionTrackingService.transitionAction(
      validated.actionId,
      validated.status,
      validated.changedBy,
      validated.notes
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to transition action', details: error.message },
      { status: 500 }
    );
  }
}
