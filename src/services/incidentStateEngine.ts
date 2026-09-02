import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';
import { factService } from './fact';
import { hypothesisService } from './hypothesis';
import { conflictService } from './conflict';
import { actionsService } from './actions';
import { decisionService } from './decision';
import { openQuestionService } from './openQuestion';
import { timelineService } from './timeline';
import { realtimeEventHub } from './eventHub';
import {
  IncidentEvent,
  EventSource,
  EventProcessingResult,
  StateAction,
  EmittedEvent,
} from '@/types/incidentEvents';

// ─────────────────────────────────────────────────────────────────────────────
// Incident State Engine
//
// Converts extracted AI events into the canonical current state of the incident.
//
// RULES:
//   1. Never silently overwrite existing evidence.
//   2. Preserve provenance — every entity traces to its source.
//   3. When new information contradicts an existing statement → create/update conflict.
//   4. Hypotheses stay hypotheses until explicitly verified.
//   5. Decisions require explicit agreement — suggestions are not decisions.
//   6. Actions get owners; if unclear → UNASSIGNED + open question.
//   7. Auto-create questions for important information gaps.
//   8. Idempotent where practical — avoid duplicate entities.
// ─────────────────────────────────────────────────────────────────────────────

export class IncidentStateEngine {
  // ───────────────────────────────────────────────────────────────────────────
  // Main entry point
  // ───────────────────────────────────────────────────────────────────────────

  async processIncidentEvent(
    incidentId: string,
    event: IncidentEvent
  ): Promise<EventProcessingResult> {
    switch (event.kind) {
      case 'OBSERVATION':
        return this.processObservation(incidentId, event);
      case 'FACT_REPORT':
        return this.processFactReport(incidentId, event);
      case 'HYPOTHESIS':
        return this.processHypothesis(incidentId, event);
      case 'DECISION':
        return this.processDecision(incidentId, event);
      case 'ACTION_ASSIGNMENT':
        return this.processActionAssignment(incidentId, event);
      case 'QUESTION':
        return this.processQuestion(incidentId, event);
      case 'CONFLICT_REPORT':
        return this.processConflictReport(incidentId, event);
      case 'RISK':
        return this.processRisk(incidentId, event);
      case 'EVIDENCE_UPDATE':
        return this.processEvidenceUpdate(incidentId, event);
      default:
        return {
          kind: 'UNKNOWN',
          stateChanged: false,
          actions: [{ operation: 'SKIPPED', entityType: 'unknown', reason: 'Unknown event kind' }],
          emittedEvents: [],
        };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OBSERVATION — a reported data point, not yet verified
  // ───────────────────────────────────────────────────────────────────────────

  private async processObservation(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'OBSERVATION' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // Check for duplicate observation (same topic + similar statement)
    const existing = await this.findSimilarFact(incidentId, event.topic, event.statement);
    if (existing) {
      actions.push({
        operation: 'SKIPPED',
        entityType: 'FACT',
        entityId: existing.id,
        reason: 'Similar observation already exists.',
      });
      return { kind: event.kind, stateChanged: false, actions, emittedEvents };
    }

    const evidence = this.buildEvidence(event.source, event.statement);
    const fact = await factService.createFact(
      incidentId,
      this.truncateTitle(event.topic),
      event.statement,
      evidence,
      'REPORTED'
    );

    actions.push({ operation: 'CREATED', entityType: 'FACT', entityId: fact.id, reason: 'New observation recorded.' });
    emittedEvents.push({
      eventName: 'fact.created',
      payload: { fact: { id: fact.id, title: fact.title, status: fact.status } },
    });
    await this.emitTimeline(incidentId, 'OBSERVATION_RECORDED', `Observation: ${event.topic}`, evidence, `Fact:${fact.id}`);

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FACT_REPORT — a claim presented as factual
  //
  // RULE: Cannot be silently created as CONFIRMED without verification.
  // ───────────────────────────────────────────────────────────────────────────

  private async processFactReport(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'FACT_REPORT' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // Check if a conflicting fact already exists
    const existingFacts = await factService.getFacts(incidentId);
    const conflict = this.findContradiction(event.topic, event.statement, existingFacts.map(f => ({ title: f.title, description: f.description, id: f.id })));

    if (conflict) {
      // Create a conflict record instead of silently overwriting
      const evidenceA = this.buildEvidence(conflict.source || event.source, conflict.existingTitle);
      const evidenceB = this.buildEvidence(event.source, event.statement);

      const conflictRecord = await conflictService.detectAndRecord(
        incidentId,
        event.topic,
        conflict.existingDescription,
        event.statement,
        evidenceA,
        evidenceB
      );

      actions.push({
        operation: 'CONFLICT_DETECTED',
        entityType: 'CONFLICT',
        entityId: conflictRecord.id,
        reason: `New fact report contradicts existing fact: "${conflict.existingTitle}"`,
      });
      emittedEvents.push({
        eventName: 'conflict.detected',
        payload: { conflict: { id: conflictRecord.id, topic: conflictRecord.topic } },
      });

      return { kind: event.kind, stateChanged: true, actions, emittedEvents };
    }

    // Check for duplicate
    const existing = await this.findSimilarFact(incidentId, event.topic, event.statement);
    if (existing) {
      actions.push({
        operation: 'SKIPPED',
        entityType: 'FACT',
        entityId: existing.id,
        reason: 'Similar fact already exists.',
      });
      return { kind: event.kind, stateChanged: false, actions, emittedEvents };
    }

    // Enforce verification constraint: facts cannot be CONFIRMED without verification
    const requestedStatus = event.claimedStatus === 'CONFIRMED' ? 'REPORTED' : 'REPORTED';

    const evidence = this.buildEvidence(event.source, event.statement);
    const fact = await factService.createFact(
      incidentId,
      this.truncateTitle(event.topic),
      event.statement,
      evidence,
      requestedStatus as any
    );

    actions.push({ operation: 'CREATED', entityType: 'FACT', entityId: fact.id, reason: 'New fact report recorded.' });
    emittedEvents.push({
      eventName: 'fact.created',
      payload: { fact: { id: fact.id, title: fact.title, status: fact.status } },
    });
    await this.emitTimeline(incidentId, 'FACT_REPORTED', `Fact reported: ${event.topic}`, evidence, `Fact:${fact.id}`);

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HYPOTHESIS — always UNCONFIRMED until explicitly verified
  //
  // RULE: Evidence can support a hypothesis, but never auto-promotes it.
  // ───────────────────────────────────────────────────────────────────────────

  private async processHypothesis(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'HYPOTHESIS' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // Check for duplicate hypothesis
    const existing = await this.findSimilarHypothesis(incidentId, event.topic, event.statement);
    if (existing) {
      actions.push({
        operation: 'SKIPPED',
        entityType: 'HYPOTHESIS',
        entityId: existing.id,
        reason: 'Similar hypothesis already exists.',
      });
      return { kind: event.kind, stateChanged: false, actions, emittedEvents };
    }

    const evidence = this.buildEvidence(event.source, event.statement);
    const hypothesis = await hypothesisService.createHypothesis(
      incidentId,
      this.truncateTitle(event.topic),
      event.statement,
      evidence
    );

    actions.push({ operation: 'CREATED', entityType: 'HYPOTHESIS', entityId: hypothesis.id, reason: 'New hypothesis proposed.' });
    emittedEvents.push({
      eventName: 'hypothesis.created',
      payload: { hypothesis: { id: hypothesis.id, title: hypothesis.title, status: hypothesis.status } },
    });

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DECISION — only created on explicit agreement
  //
  // RULE: Suggestions are NOT decisions. Requires agreedBy list.
  // ───────────────────────────────────────────────────────────────────────────

  private async processDecision(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'DECISION' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // RULE: A decision requires explicit agreement. If no one agreed, create
    // an open question instead.
    if (!event.agreedBy || event.agreedBy.length === 0) {
      const evidence = this.buildEvidence(event.source, event.statement);
      const question = await openQuestionService.askQuestion(
        incidentId,
        `Decision needed: ${this.truncateTitle(event.topic)}`,
        `Suggestion made but no explicit agreement recorded: ${event.statement}`,
        evidence
      );

      actions.push({
        operation: 'CREATED',
        entityType: 'OPEN_QUESTION',
        entityId: question.id,
        reason: 'Decision suggested but no agreement recorded — created open question.',
      });
      emittedEvents.push({
        eventName: 'question.created',
        payload: { question: { id: question.id, title: question.title } },
      });

      return { kind: event.kind, stateChanged: true, actions, emittedEvents };
    }

    const evidence = this.buildEvidence(event.source, event.statement);
    const decidedBy = event.agreedBy.join(', ');
    const decision = await decisionService.recordDecision(
      incidentId,
      this.truncateTitle(event.topic),
      event.statement,
      decidedBy,
      evidence
    );

    actions.push({ operation: 'CREATED', entityType: 'DECISION', entityId: decision.id, reason: 'Decision recorded with explicit agreement.' });
    emittedEvents.push({
      eventName: 'decision.created',
      payload: { decision: { id: decision.id, title: decision.title, decidedBy } },
    });

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACTION_ASSIGNMENT — concrete task with owner
  //
  // RULE: If owner unclear → UNASSIGNED + open question.
  // Critical actions → approval request (never auto-execute).
  // ───────────────────────────────────────────────────────────────────────────

  private async processActionAssignment(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'ACTION_ASSIGNMENT' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // Resolve assignee
    let assigneeId: string | undefined;
    const isUnassigned = !event.assignee || event.assignee.toUpperCase() === 'UNASSIGNED';

    if (!isUnassigned) {
      const resolved = await this.resolveParticipant(incidentId, event.assignee);
      assigneeId = resolved?.userId;
    }

    const evidence = this.buildEvidence(event.source, event.statement);
    const action = await actionsService.createAction(
      incidentId,
      this.truncateTitle(event.topic),
      event.statement,
      evidence,
      assigneeId
    );

    actions.push({ operation: 'CREATED', entityType: 'ACTION', entityId: action.id, reason: `Action assigned to ${event.assignee || 'UNASSIGNED'}.` });
    emittedEvents.push({
      eventName: 'action.created',
      payload: { action: { id: action.id, title: action.title, status: action.status, assigneeId } },
    });

    // If unassigned, create an open question
    if (isUnassigned) {
      const question = await openQuestionService.askQuestion(
        incidentId,
        `Who owns: ${this.truncateTitle(event.topic)}?`,
        `Action created but no owner identified: ${event.statement}`,
        evidence
      );
      actions.push({ operation: 'CREATED', entityType: 'OPEN_QUESTION', entityId: question.id, reason: 'No owner identified — created open question.' });
      emittedEvents.push({
        eventName: 'question.created',
        payload: { question: { id: question.id, title: question.title } },
      });
    }

    // Flag critical actions for approval
    if (event.isCritical) {
      await this.flagCriticalAction(incidentId, action.id, action.title, event.statement);
      emittedEvents.push({
        eventName: 'approval.required',
        payload: { actionId: action.id, title: action.title },
      });
    }

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // QUESTION — information gap
  // ───────────────────────────────────────────────────────────────────────────

  private async processQuestion(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'QUESTION' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // Check for duplicate open question
    const existing = await this.findSimilarQuestion(incidentId, event.topic);
    if (existing) {
      actions.push({
        operation: 'SKIPPED',
        entityType: 'OPEN_QUESTION',
        entityId: existing.id,
        reason: 'Similar open question already exists.',
      });
      return { kind: event.kind, stateChanged: false, actions, emittedEvents };
    }

    const evidence = this.buildEvidence(event.source, event.statement);
    const question = await openQuestionService.askQuestion(
      incidentId,
      this.truncateTitle(event.topic),
      event.statement,
      evidence
    );

    actions.push({ operation: 'CREATED', entityType: 'OPEN_QUESTION', entityId: question.id, reason: 'New open question created.' });
    emittedEvents.push({
      eventName: 'question.created',
      payload: { question: { id: question.id, title: question.title } },
    });

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CONFLICT_REPORT — two contradicting claims
  // ───────────────────────────────────────────────────────────────────────────

  private async processConflictReport(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'CONFLICT_REPORT' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // Check for existing unresolved conflict on same topic
    const existingConflicts = await conflictService.getConflicts(incidentId);
    const duplicate = existingConflicts.find(
      (c) => c.status === 'UNRESOLVED' && c.topic.toLowerCase() === event.topic.toLowerCase()
    );

    if (duplicate) {
      actions.push({
        operation: 'SKIPPED',
        entityType: 'CONFLICT',
        entityId: duplicate.id,
        reason: 'Unresolved conflict on this topic already exists.',
      });
      return { kind: event.kind, stateChanged: false, actions, emittedEvents };
    }

    const sourceA = this.buildEvidence(event.sourceA, event.claimA);
    const sourceB = this.buildEvidence(event.sourceB, event.claimB);

    const conflict = await conflictService.detectAndRecord(
      incidentId,
      event.topic,
      event.claimA,
      event.claimB,
      sourceA,
      sourceB
    );

    actions.push({ operation: 'CONFLICT_DETECTED', entityType: 'CONFLICT', entityId: conflict.id, reason: 'Conflict detected between two claims.' });
    emittedEvents.push({
      eventName: 'conflict.detected',
      payload: { conflict: { id: conflict.id, topic: conflict.topic, claimA: conflict.claimA, claimB: conflict.claimB } },
    });

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RISK — something that could go wrong
  // ───────────────────────────────────────────────────────────────────────────

  private async processRisk(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'RISK' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    const evidence = this.buildEvidence(event.source, event.statement);

    // Record as timeline event
    await timelineService.addEvent(
      incidentId,
      'RISK',
      `Risk identified: ${event.topic} — ${event.statement}`,
      evidence,
      undefined,
      event.source.confidence,
      new Date(event.source.timestamp)
    );

    // Also create an open question for tracking
    const question = await openQuestionService.askQuestion(
      incidentId,
      `Risk: ${this.truncateTitle(event.topic)}`,
      `${event.statement} (risk requiring attention)`,
      evidence
    );

    actions.push({ operation: 'CREATED', entityType: 'RISK', entityId: question.id, reason: 'Risk recorded and tracked as open question.' });
    emittedEvents.push({
      eventName: 'question.created',
      payload: { question: { id: question.id, title: question.title } },
    });

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EVIDENCE_UPDATE — attach new evidence to existing entity
  // ───────────────────────────────────────────────────────────────────────────

  private async processEvidenceUpdate(
    incidentId: string,
    event: Extract<IncidentEvent, { kind: 'EVIDENCE_UPDATE' }>
  ): Promise<EventProcessingResult> {
    const actions: StateAction[] = [];
    const emittedEvents: EmittedEvent[] = [];

    // For now, record as a timeline event linking to the entity
    const evidence = this.buildEvidence(event.source, event.notes || 'Evidence update');
    await timelineService.addEvent(
      incidentId,
      'EVIDENCE_ADDED',
      `New evidence attached to ${event.entityType}:${event.entityId}`,
      evidence,
      `${event.entityType}:${event.entityId}`,
      event.source.confidence,
      new Date(event.source.timestamp)
    );

    actions.push({ operation: 'UPDATED', entityType: event.entityType, entityId: event.entityId, reason: 'Evidence update recorded.' });
    emittedEvents.push({
      eventName: 'incident.updated',
      payload: { incidentId, state: {} as any },
    });

    return { kind: event.kind, stateChanged: true, actions, emittedEvents };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Build evidence envelope
  // ───────────────────────────────────────────────────────────────────────────

  private buildEvidence(source: EventSource, statement: string): EvidenceMetadata {
    return {
      sourceType: source.type,
      sourceId: source.speakerId || source.transcriptId,
      sourceText: statement,
      speakerId: source.speakerId || source.speakerName,
      timestamp: source.timestamp,
      confidence: source.confidence,
      verificationStatus: 'UNVERIFIED',
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Truncate title to 80 chars
  // ───────────────────────────────────────────────────────────────────────────

  private truncateTitle(text: string): string {
    const trimmed = text.trim();
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Resolve participant name to userId
  // ───────────────────────────────────────────────────────────────────────────

  private async resolveParticipant(incidentId: string, name: string) {
    if (!name || name.toUpperCase() === 'UNASSIGNED') return null;
    const participant = await prisma.participant.findFirst({
      where: {
        incidentId,
        user: { name: { contains: name, mode: 'insensitive' } },
      },
      include: { user: true },
    });
    if (!participant) return null;
    return { participantId: participant.id, userId: participant.userId, role: participant.role };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Find similar fact (idempotency)
  // ───────────────────────────────────────────────────────────────────────────

  private async findSimilarFact(incidentId: string, topic: string, statement: string) {
    const facts = await factService.getFacts(incidentId);
    const normalisedTopic = topic.toLowerCase().trim();
    const normalisedStatement = statement.toLowerCase().trim();

    return facts.find((f) => {
      const fTitle = f.title.toLowerCase().trim();
      const fDesc = f.description.toLowerCase().trim();
      return (
        fTitle === normalisedTopic ||
        fDesc === normalisedStatement ||
        fTitle.includes(normalisedTopic) ||
        normalisedTopic.includes(fTitle)
      );
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Find similar hypothesis (idempotency)
  // ───────────────────────────────────────────────────────────────────────────

  private async findSimilarHypothesis(incidentId: string, topic: string, statement: string) {
    const hypotheses = await hypothesisService.getHypotheses(incidentId);
    const normalisedTopic = topic.toLowerCase().trim();
    const normalisedStatement = statement.toLowerCase().trim();

    return hypotheses.find((h) => {
      const hTitle = h.title.toLowerCase().trim();
      const hDesc = h.description.toLowerCase().trim();
      return (
        hTitle === normalisedTopic ||
        hDesc === normalisedStatement ||
        hTitle.includes(normalisedTopic) ||
        normalisedTopic.includes(hTitle)
      );
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Find similar open question (idempotency)
  // ───────────────────────────────────────────────────────────────────────────

  private async findSimilarQuestion(incidentId: string, topic: string) {
    const questions = await openQuestionService.getQuestions(incidentId);
    const normalised = topic.toLowerCase().trim();
    return questions.find((q) => !q.resolved && q.title.toLowerCase().trim().includes(normalised));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Detect contradiction between new statement and existing facts
  // ───────────────────────────────────────────────────────────────────────────

  private findContradiction(
    topic: string,
    newStatement: string,
    existingFacts: Array<{ title: string; description: string; id: string }>
  ): { existingTitle: string; existingDescription: string; source?: EventSource } | null {
    const normalisedTopic = topic.toLowerCase().trim();

    for (const fact of existingFacts) {
      const factTitle = fact.title.toLowerCase().trim();

      // If same topic but different claims, it's a contradiction
      if (factTitle === normalisedTopic || factTitle.includes(normalisedTopic) || normalisedTopic.includes(factTitle)) {
        const factDesc = fact.description.toLowerCase().trim();
        const newDesc = newStatement.toLowerCase().trim();

        // If descriptions are significantly different, it's a contradiction
        if (factDesc !== newDesc && !factDesc.includes(newDesc) && !newDesc.includes(factDesc)) {
          return {
            existingTitle: fact.title,
            existingDescription: fact.description,
          };
        }
      }
    }
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Flag critical action for approval
  // ───────────────────────────────────────────────────────────────────────────

  private async flagCriticalAction(
    incidentId: string,
    actionId: string,
    title: string,
    details: string
  ): Promise<void> {
    await prisma.approvalRequest.create({
      data: {
        incidentId,
        actionId,
        actionTitle: title,
        actionDetails: details,
        requestedBy: 'Incident State Engine (Critical Action)',
        status: 'PENDING',
        evidence: {
          sourceType: 'HUMAN_SPOKEN',
          sourceText: details,
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'UNVERIFIED',
        } as any,
      },
    });

    // Gate the linked action until a human grants approval.
    await prisma.actionItem.update({
      where: { id: actionId },
      data: { requiresApproval: true },
    });

    await timelineService.addEvent(
      incidentId,
      'CRITICAL_ACTION_FLAGGED',
      `Critical action flagged for approval: "${title}"`,
      {
        sourceType: 'HUMAN_SPOKEN',
        sourceText: details,
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        verificationStatus: 'UNVERIFIED',
      },
      `ActionItem:${actionId}`,
      1.0,
      new Date()
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helper: Emit timeline event
  // ───────────────────────────────────────────────────────────────────────────

  private async emitTimeline(
    incidentId: string,
    eventType: string,
    description: string,
    evidence: EvidenceMetadata,
    relatedEntity?: string
  ): Promise<void> {
    await timelineService.addEvent(incidentId, eventType, description, evidence, relatedEntity);

    // Notify clients that incident state changed (they can refetch timeline)
    realtimeEventHub.emitToIncident(incidentId, 'incident.updated', {
      incidentId,
      state: {} as any, // Lightweight signal — full state refetch on client
    });
  }
}

export const incidentStateEngine = new IncidentStateEngine();
