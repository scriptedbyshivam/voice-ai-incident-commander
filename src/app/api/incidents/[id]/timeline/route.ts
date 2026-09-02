import { NextRequest, NextResponse } from 'next/server';
import { incidentTimelineEngine, TimelineFilter } from '@/services/incidentTimelineEngine';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/incidents/:id/timeline — Get incident timeline with filtering
// Query params:
//   order=latest|chronological
//   eventType=ALERT|OBSERVATION|...
//   sourceType=MONITORING|HUMAN_SPOKEN|...
//   limit=50
//   offset=0
//   fromTimestamp=2024-01-01T00:00:00Z
//   toTimestamp=2024-01-02T00:00:00Z
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const { searchParams } = new URL(req.url);

    const filter: TimelineFilter = {
      order: (searchParams.get('order') as 'latest' | 'chronological') || 'chronological',
      eventType: searchParams.get('eventType') || undefined,
      sourceType: searchParams.get('sourceType') || undefined,
      limit: parseInt(searchParams.get('limit') || '100', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
      fromTimestamp: searchParams.get('fromTimestamp') || undefined,
      toTimestamp: searchParams.get('toTimestamp') || undefined,
    };

    const result = await incidentTimelineEngine.getIncidentTimeline(incidentId, filter);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch timeline', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/incidents/:id/timeline — Create a timeline event via the engine
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json();

     const event = await incidentTimelineEngine.createEvent({
       incidentId,
       eventType: body.eventType,
       description: body.description,
       sourceType: body.sourceType,
       sourceId: body.sourceId,
       speaker: body.speaker || null,
       speakerRole: body.speakerRole || null,
       confidence: body.confidence,
       relatedEntity: body.relatedEntity || null,
       timestamp: body.timestamp,
     });

    return NextResponse.json(event);
  } catch (error: any) {
    if (error.message?.includes('Invalid event type') || error.message?.includes('Invalid source type')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create timeline event', details: error.message },
      { status: 500 }
    );
  }
}