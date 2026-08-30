import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incidentService } from '@/services/incident';

const UpdateIncidentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']).optional(),
  status: z.enum(['ACTIVE', 'RESOLVED', 'CLOSED']).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const incidentState = await incidentService.getIncident(id);

    if (!incidentState) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json(incidentState);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch incident details', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = UpdateIncidentSchema.parse(body);

    const updated = await incidentService.updateIncident(id, validated);
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to update incident', details: error.message },
      { status: 500 }
    );
  }
}
