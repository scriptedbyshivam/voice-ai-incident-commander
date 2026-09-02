import { NextRequest, NextResponse } from 'next/server';
import { uncertaintyService } from '@/services/uncertainty';

type RouteParams = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/incidents/:id/uncertainty — Get uncertainty dashboard
//
// Returns all uncertainty signals: conflicts, missing info, unassigned actions,
// stale info, unresolved decisions.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const dashboard = await uncertaintyService.scanIncident(incidentId);
    return NextResponse.json(dashboard);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to scan uncertainty', details: error.message },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/uncertainty — Run specific uncertainty detection
//
// Body: { "action": "detectConflicts" | "generateQuestion" | "markSuperseded", ... }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json();

    switch (body.action) {
      case 'detectConflicts': {
        const conflicts = await uncertaintyService.detectConflictsDeterministic(
          incidentId,
          body.topic || '',
          body.statement || ''
        );
        return NextResponse.json({ conflicts });
      }

      case 'generateQuestion': {
        const dashboard = await uncertaintyService.scanIncident(incidentId);
        // Find the highest severity signal and generate a question for it
        const highSignal = dashboard.signals.find((s) => s.severity === 'HIGH');
        return NextResponse.json({
          signal: highSignal || null,
          recommendation: highSignal?.recommendation || 'No critical uncertainties detected.',
        });
      }

      case 'markSuperseded': {
        await uncertaintyService.markSuperseded(
          body.factId,
          body.supersededBy || 'system',
          body.reason || 'Superseded by newer information'
        );
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action. Use: detectConflicts, generateQuestion, markSuperseded' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process uncertainty action', details: error.message },
      { status: 500 }
    );
  }
}
