import prisma from '@/lib/db';
import {
  IncidentState,
  IncidentStatus,
  Severity,
  ParticipantSummary,
  ParticipantRole,
  FactSummary,
  HypothesisSummary,
  DecisionSummary,
  ActionItemSummary,
  ConflictSummary,
  OpenQuestionSummary,
  TimelineEventSummary,
  EvidenceMetadata,
} from '@/types/incident';

export class IncidentStateAggregationService {
  async getIncidentState(incidentId: string): Promise<IncidentState | null> {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
        facts: true,
        hypotheses: true,
        decisions: true,
        actions: {
          include: {
            assignee: true,
            history: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        conflicts: true,
        questions: true,
        timeline: {
          orderBy: { timestamp: 'asc' }, // Sort timeline chronologically, never depend on DB insertion order
        },
        summaries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!incident) return null;

    // Convert raw database models to structured summaries
    const participants: ParticipantSummary[] = incident.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      role: p.role as ParticipantRole,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt ? p.leftAt.toISOString() : null,
    }));

    const facts: FactSummary[] = incident.facts.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status as any,
      evidence: f.evidence as unknown as EvidenceMetadata,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));

    const hypotheses: HypothesisSummary[] = incident.hypotheses.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      status: h.status as any,
      evidence: h.evidence as unknown as EvidenceMetadata,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    }));

    const decisions: DecisionSummary[] = incident.decisions.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      decidedBy: d.decidedBy,
      evidence: d.evidence as unknown as EvidenceMetadata,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));

    const actions: ActionItemSummary[] = incident.actions.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      status: a.status as any,
      assigneeId: a.assigneeId,
      assigneeName: a.assignee ? a.assignee.name : null,
      dueAt: a.dueAt ? a.dueAt.toISOString() : undefined,
      blockedReason: a.blockedReason || undefined,
      completionNotes: a.completionNotes || undefined,
      history: a.history.map((h) => ({
        id: h.id,
        oldStatus: h.oldStatus as any,
        newStatus: h.newStatus as any,
        changedBy: h.changedBy,
        notes: h.notes || undefined,
        createdAt: h.createdAt.toISOString(),
      })),
      evidence: a.evidence as unknown as EvidenceMetadata,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    const conflicts: ConflictSummary[] = incident.conflicts.map((c) => ({
      id: c.id,
      topic: c.topic,
      claimA: c.claimA,
      claimB: c.claimB,
      sourceA: c.sourceA as unknown as EvidenceMetadata,
      sourceB: c.sourceB as unknown as EvidenceMetadata,
      status: c.status,
      detectedAt: c.detectedAt.toISOString(),
      resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : undefined,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    const openQuestions: OpenQuestionSummary[] = incident.questions.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description || '',
      resolved: q.resolved,
      evidence: q.evidence as unknown as EvidenceMetadata,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    }));

    const timeline: TimelineEventSummary[] = incident.timeline.map((t) => ({
      id: t.id,
      eventType: t.eventType,
      description: t.description,
      eventTime: t.timestamp.toISOString(), // Standardized timestamp mapping
      evidence: t.source as unknown as EvidenceMetadata,
      createdAt: t.createdAt.toISOString(),
    }));

    // Split facts into confirmed and reported observations
    const confirmedFacts = facts.filter((f) => f.status === 'CONFIRMED');
    const reportedObservations = facts.filter((f) => f.status !== 'CONFIRMED');

    // Compile unresolved risks based on unresolved conflicts and open questions
    const unresolvedRisks = [
      ...conflicts.filter((c) => c.status === 'UNRESOLVED').map((c) => `Conflict Topic: ${c.topic}`),
      ...openQuestions.filter((q) => !q.resolved).map((q) => `Open Question: ${q.title}`),
    ];

    const latestSummary = incident.summaries[0] ? incident.summaries[0].summaryText : null;

    return {
      incidentId: incident.id,
      title: incident.title,
      description: incident.description,
      currentStatus: incident.status as IncidentStatus,
      severity: incident.severity as Severity,
      createdAt: incident.createdAt.toISOString(),
      participants,
      confirmedFacts,
      reportedObservations,
      hypotheses,
      decisions,
      actions,
      conflicts,
      openQuestions,
      unresolvedRisks,
      timeline,
      latestSummary,
    };
  }
}

export const incidentStateAggregationService = new IncidentStateAggregationService();
export default incidentStateAggregationService;
