import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { approvalsService } from '@/services/approvals';

const ActionResolutionSchema = z.object({
  user: z.string().min(1, 'User name or ID is required'),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = ActionResolutionSchema.parse(body);

    const updated = await approvalsService.approveRequest(id, validated.user);
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to approve request', details: error.message },
      { status: 500 }
    );
  }
}
