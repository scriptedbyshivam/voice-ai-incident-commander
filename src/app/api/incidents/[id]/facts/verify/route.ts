import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { factService } from '@/services/fact';

const VerifyFactSchema = z.object({
  factId: z.string().uuid('Invalid Fact ID format'),
  verifierName: z.string().min(1, 'Verifier name is required'),
  notes: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Ensure incident ID from URL params is valid
    const { id: incidentId } = await params;
    if (!incidentId) {
      return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const validated = VerifyFactSchema.parse(body);

    const updatedFact = await factService.verifyFact(
      validated.factId,
      validated.verifierName,
      validated.notes
    );

    return NextResponse.json(updatedFact);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to verify fact', details: error.message },
      { status: 500 }
    );
  }
}
