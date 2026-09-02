import { NextRequest, NextResponse } from 'next/server';
import { actionTrackingService } from '@/services/actionTracking';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/incidents/:id/actions/board — Get Kanban-style action board
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const board = await actionTrackingService.getActionBoard(incidentId);
    return NextResponse.json(board);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch action board', details: error.message },
      { status: 500 }
    );
  }
}
