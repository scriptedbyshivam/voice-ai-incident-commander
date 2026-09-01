import { NextRequest, NextResponse } from 'next/server';
import { incidentService } from '@/services/incident';
import { slaMonitorService } from '@/services/slaMonitor';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const incidentState = await incidentService.getIncident(id);

    if (!incidentState) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const slaStatus = slaMonitorService.checkSlaStatus(
      incidentState.createdAt,
      incidentState.severity
    );

    return NextResponse.json(slaStatus);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve SLA status', details: error.message },
      { status: 500 }
    );
  }
}
