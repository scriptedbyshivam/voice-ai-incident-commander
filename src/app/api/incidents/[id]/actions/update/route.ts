import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { actionsService } from '@/services/actions';

const UpdateActionStatusSchema = z.object({
  actionId: z.string().uuid('Invalid Action ID format'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']),
  changedBy: z.string().min(1, 'Changer name is required'),
  notes: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    if (!incidentId) {
      return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const validated = UpdateActionStatusSchema.parse(body);

    const updatedAction = await actionsService.updateActionStatus(
      validated.actionId,
      validated.status,
      validated.changedBy,
      validated.notes
    );

    return NextResponse.json(updatedAction);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to update action status', details: error.message },
      { status: 500 }
    );
  }
}
