import { NextRequest, NextResponse } from 'next/server';
import { actionTrackingService } from '@/services/actionTracking';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/incidents/:id/actions/reminders — Get stale action reminders
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;

    const staleReminders = await actionTrackingService.detectStaleActions(incidentId);
    const dependencyBlockers = await actionTrackingService.detectDependencyBlockers(incidentId);

    return NextResponse.json({
      stale: staleReminders,
      blockers: dependencyBlockers,
      total: staleReminders.length + dependencyBlockers.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch reminders', details: error.message },
      { status: 500 }
    );
  }
}
