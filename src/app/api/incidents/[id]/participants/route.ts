import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incidentService } from '@/services/incident';

const AddParticipantSchema = z.object({
  userId: z.string().uuid('Invalid User ID format'),
  role: z.enum(['INCIDENT_COMMANDER', 'ENGINEER', 'SRE', 'SUPPORT', 'PRODUCT', 'BUSINESS', 'OBSERVER']),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const participants = await incidentService.getParticipants(id);
    return NextResponse.json(participants);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch participants', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = AddParticipantSchema.parse(body);

    const participant = await incidentService.addParticipant(
      id,
      validated.userId,
      validated.role
    );

    return NextResponse.json(participant, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to add participant', details: error.message },
      { status: 500 }
    );
  }
}
