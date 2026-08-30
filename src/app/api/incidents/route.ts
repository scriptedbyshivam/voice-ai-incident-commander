import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incidentService } from '@/services/incident';

const CreateIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']),
  description: z.string().optional(),
  commander: z.object({
    name: z.string().min(1, 'Commander name is required'),
    email: z.string().email('Invalid Commander email format'),
  }).optional(),
  participants: z.array(z.object({
    name: z.string().min(1, 'Participant name is required'),
    role: z.enum(['INCIDENT_COMMANDER', 'ENGINEER', 'SRE', 'SUPPORT', 'PRODUCT', 'BUSINESS', 'OBSERVER']),
    email: z.string().email('Invalid Participant email format').optional(),
  })).optional(),
});

export async function GET() {
  try {
    const list = await incidentService.listIncidents();
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch incidents', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CreateIncidentSchema.parse(body);

    const newIncident = await incidentService.createIncident(
      validated.title,
      validated.severity,
      validated.description,
      validated.commander,
      validated.participants
    );

    return NextResponse.json(newIncident, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create incident', details: error.message },
      { status: 500 }
    );
  }
}
