import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incidentService } from '@/services/incident';
import { notificationService } from '@/services/notifications';

const NotifySchema = z.object({
  eventType: z.enum(['INCIDENT_CREATED', 'SEVERITY_CHANGED', 'FACT_CONFIRMED', 'DECISION_MADE', 'INCIDENT_RESOLVED']),
  message: z.string().min(1, 'Message is required'),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = NotifySchema.parse(body);

    const incidentState = await incidentService.getIncident(id);
    if (!incidentState) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const result = await notificationService.dispatchNotification({
      incidentId: id,
      title: incidentState.title,
      severity: incidentState.severity,
      status: incidentState.currentStatus,
      eventType: validated.eventType,
      message: validated.message,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', errors: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to dispatch notification', details: error.message },
      { status: 500 }
    );
  }
}
