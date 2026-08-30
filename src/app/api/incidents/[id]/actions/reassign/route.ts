import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { actionsService } from '@/services/actions';

const ReassignActionSchema = z.object({
  actionId: z.string().uuid('Invalid Action ID format'),
  assigneeId: z.string().uuid('Invalid Assignee User ID format').nullable(),
  changedBy: z.string().min(1, 'Changer name is required'),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    if (!incidentId) {
      return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const validated = ReassignActionSchema.parse(body);

    const updatedAction = await actionsService.reassignAction(
      validated.actionId,
      validated.assigneeId,
      validated.changedBy
    );

    return NextResponse.json(updatedAction);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to reassign action', details: error.message },
      { status: 500 }
    );
  }
}
