import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hypothesisService } from '@/services/hypothesis';

const VerifyHypothesisSchema = z.object({
  hypothesisId: z.string().uuid('Invalid Hypothesis ID format'),
  verifierName: z.string().min(1, 'Verifier name is required'),
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
    const validated = VerifyHypothesisSchema.parse(body);

    const result = await hypothesisService.verifyHypothesis(
      validated.hypothesisId,
      validated.verifierName,
      validated.notes
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to verify hypothesis', details: error.message },
      { status: 500 }
    );
  }
}
