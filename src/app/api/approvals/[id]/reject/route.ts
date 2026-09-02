import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { approvalsService } from '@/services/approvals';

const ActionResolutionSchema = z.object({
  user: z.string().min(1, 'User name or ID is required'),
  reason: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/approvals/:id/reject
 *
 * Human rejection of a pending critical action. Rejection NEVER executes the
 * action and marks the linked action as CANCELLED.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = ActionResolutionSchema.parse(body);

    const updated = await approvalsService.rejectRequest(id, validated.user, validated.reason);
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}