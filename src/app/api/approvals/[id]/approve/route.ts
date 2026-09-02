import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { approvalsService } from '@/services/approvals';

const ActionResolutionSchema = z.object({
  user: z.string().min(1, 'User name or ID is required'),
  confirmationText: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/approvals/:id/approve
 *
 * Human approval of a pending critical action. Execution of the (mock,
 * sandbox) action is triggered ONLY here — after an explicit human decision.
 * Dangerous actions require the reviewer to type "CONFIRM".
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = ActionResolutionSchema.parse(body);

    const updated = await approvalsService.approveRequest(
      id,
      validated.user,
      validated.confirmationText
    );
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    // Expected business-rule rejections (not approved, expired, missing CONFIRM).
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}