import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { approvalsService } from '@/services/approvals';

const CreateApprovalSchema = z.object({
  actionTitle: z.string().min(1, 'Action title is required'),
  actionDetails: z.string().min(1, 'Action details are required'),
  requestedBy: z.string().min(1, 'Requested by is required'),
  actionId: z.string().uuid().optional(),
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
  evidence: z.any().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const requests = await approvalsService.getIncidentRequests(id);
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch approval requests', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = CreateApprovalSchema.parse(body);

    const expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : null;
    const approval = await approvalsService.createRequest(
      id,
      validated.actionTitle,
      validated.actionDetails,
      validated.requestedBy,
      validated.evidence,
      { actionId: validated.actionId, reason: validated.reason, expiresAt }
    );

    return NextResponse.json(approval, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create approval request', details: error.message },
      { status: 500 }
    );
  }
}