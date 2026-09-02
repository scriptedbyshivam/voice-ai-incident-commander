import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incidentStateEngine } from '@/services/incidentStateEngine';
import { IncidentEvent } from '@/types/incidentEvents';

type RouteParams = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas for each event kind
// ─────────────────────────────────────────────────────────────────────────────

const EventSourceSchema = z.object({
  type: z.enum(['HUMAN_SPOKEN', 'MONITORING', 'DEPLOYMENT_SYSTEM', 'SLACK', 'JIRA', 'PAGERDUTY', 'MANUAL_CONFIRMATION']),
  speakerId: z.string().optional(),
  speakerName: z.string().optional(),
  speakerRole: z.string().optional(),
  transcriptId: z.string().optional(),
  timestamp: z.string(),
  confidence: z.number().min(0).max(1),
});

const ObservationEventSchema = z.object({
  kind: z.literal('OBSERVATION'),
  topic: z.string().min(1),
  statement: z.string().min(1),
  source: EventSourceSchema,
});

const FactReportEventSchema = z.object({
  kind: z.literal('FACT_REPORT'),
  topic: z.string().min(1),
  statement: z.string().min(1),
  source: EventSourceSchema,
  claimedStatus: z.enum(['REPORTED', 'CONFIRMED']).optional(),
});

const HypothesisEventSchema = z.object({
  kind: z.literal('HYPOTHESIS'),
  topic: z.string().min(1),
  statement: z.string().min(1),
  source: EventSourceSchema,
  supportingEvidence: z.array(z.string()).optional(),
});

const DecisionEventSchema = z.object({
  kind: z.literal('DECISION'),
  topic: z.string().min(1),
  statement: z.string().min(1),
  source: EventSourceSchema,
  agreedBy: z.array(z.string()).optional(),
});

const ActionAssignmentEventSchema = z.object({
  kind: z.literal('ACTION_ASSIGNMENT'),
  topic: z.string().min(1),
  statement: z.string().min(1),
  source: EventSourceSchema,
  assignee: z.string().min(1),
  isCritical: z.boolean().optional(),
});

const QuestionEventSchema = z.object({
  kind: z.literal('QUESTION'),
  topic: z.string().min(1),
  statement: z.string().min(1),
  source: EventSourceSchema,
});

const ConflictReportEventSchema = z.object({
  kind: z.literal('CONFLICT_REPORT'),
  topic: z.string().min(1),
  claimA: z.string().min(1),
  claimB: z.string().min(1),
  sourceA: EventSourceSchema,
  sourceB: EventSourceSchema,
});

const RiskEventSchema = z.object({
  kind: z.literal('RISK'),
  topic: z.string().min(1),
  statement: z.string().min(1),
  source: EventSourceSchema,
});

const EvidenceUpdateEventSchema = z.object({
  kind: z.literal('EVIDENCE_UPDATE'),
  entityType: z.enum(['FACT', 'HYPOTHESIS', 'ACTION', 'CONFLICT', 'QUESTION']),
  entityId: z.string().min(1),
  source: EventSourceSchema,
  newStatus: z.string().optional(),
  notes: z.string().optional(),
});

const IncidentEventSchema = z.discriminatedUnion('kind', [
  ObservationEventSchema,
  FactReportEventSchema,
  HypothesisEventSchema,
  DecisionEventSchema,
  ActionAssignmentEventSchema,
  QuestionEventSchema,
  ConflictReportEventSchema,
  RiskEventSchema,
  EvidenceUpdateEventSchema,
]);

const BatchEventsSchema = z.object({
  events: z.array(IncidentEventSchema).min(1).max(50),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/events — Process one or more incident events
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: incidentId } = await params;
    const body = await req.json();

    // Support both single event and batch
    let events: IncidentEvent[];
    if (Array.isArray(body.events)) {
      const validated = BatchEventsSchema.parse(body);
      events = validated.events;
    } else {
      const validated = IncidentEventSchema.parse(body);
      events = [validated];
    }

    const results = [];
    for (const event of events) {
      const result = await incidentStateEngine.processIncidentEvent(incidentId, event);
      results.push(result);
    }

    // Summary
    const totalCreated = results.reduce((sum, r) => sum + r.actions.filter((a) => a.operation === 'CREATED').length, 0);
    const totalConflicts = results.reduce((sum, r) => sum + r.actions.filter((a) => a.operation === 'CONFLICT_DETECTED').length, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.actions.filter((a) => a.operation === 'SKIPPED').length, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.actions.filter((a) => a.operation === 'UPDATED').length, 0);

    return NextResponse.json({
      processed: events.length,
      summary: {
        created: totalCreated,
        updated: totalUpdated,
        conflicts: totalConflicts,
        skipped: totalSkipped,
      },
      results,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process event', details: error.message },
      { status: 500 }
    );
  }
}
