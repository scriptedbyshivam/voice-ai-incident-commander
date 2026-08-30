import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { conflictService } from '@/services/conflict';

const ResolveConflictSchema = z.object({
  conflictId: z.string().uuid('Invalid Conflict ID format'),
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
    const validated = ResolveConflictSchema.parse(body);

    const updatedConflict = await conflictService.resolveConflict(
      validated.conflictId,
      validated.verifierName,
      validated.notes
    );

    return NextResponse.json(updatedConflict);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to resolve conflict', details: error.message },
      { status: 500 }
    );
  }
}
