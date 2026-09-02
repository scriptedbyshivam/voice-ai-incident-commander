import prisma from '@/lib/db';
import { EvidenceMetadata, FactSummary, ConflictSummary, OpenQuestionSummary, ActionItemSummary, HypothesisSummary } from '@/types/incident';
import { factService } from './fact';
import { actionsService } from './actions';
import { openQuestionService } from './openQuestion';
import { timelineService } from './timeline';
import { aiProvider } from './ai';
import { incidentStateAggregationService } from './aggregation';

// ─────────────────────────────────────────────────────────────────────────────
// Uncertainty Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UncertaintySignal {
  kind: 'CONFLICT' | 'MISSING_INFO' | 'UNASSIGNED_ACTION' | 'STALE_INFO' | 'UNRESOLVED_DECISION' | 'UNVERIFIED_HYPOTHESIS';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  topic: string;
  description: string;
  recommendation: string;
  relatedEntityIds: string[];
  detectedAt: string;
}

export interface UncertaintyDashboard {
  incidentId: string;
  detectedAt: string;
  signals: UncertaintySignal[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  conflicts: ConflictSummary[];
  openQuestions: OpenQuestionSummary[];
  unassignedActions: ActionItemSummary[];
  staleFacts: StaleFactInfo[];
  unresolvedDecisions: UnresolvedDecisionInfo[];
  unverifiedHypotheses: HypothesisSummary[];
}

export interface StaleFactInfo {
  fact: FactSummary;
  reason: string;
  newerEvidence?: string;
}

export interface UnresolvedDecisionInfo {
  topic: string;
  lastMentioned: string;
  context: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Uncertainty Service
//
// Detects 5 categories of uncertainty:
//   1. Conflicting claims (deterministic + AI)
//   2. Missing information (gap analysis)
//   3. Unclear ownership (unassigned actions)
//   4. Stale information (old/unverified evidence)
//   5. Unresolved decisions (suggestions without agreement)
// ─────────────────────────────────────────────────────────────────────────────

export class UncertaintyService {
  // ─────────────────────────────────────────────────────────────────────────
  // Full dashboard scan — runs all detectors
  // ─────────────────────────────────────────────────────────────────────────

  async scanIncident(incidentId: string): Promise<UncertaintyDashboard> {
    const state = await incidentStateAggregationService.getIncidentState(incidentId);
    if (!state) {
      return this.emptyDashboard(incidentId);
    }

    const signals: UncertaintySignal[] = [];

    // 1. Conflict detection (already in state.conflicts)
    const conflictSignals = this.detectConflictSignals(state.conflicts);
    signals.push(...conflictSignals);

    // 2. Missing information detection
    const missingSignals = await this.detectMissingInformation(incidentId, state);
    signals.push(...missingSignals);

    // 3. Unclear ownership detection
    const ownershipSignals = this.detectUnclearOwnership(state.actions);
    signals.push(...ownershipSignals);

    // 4. Stale information detection
    const staleSignals = await this.detectStaleInformation(incidentId, state.reportedObservations);
    signals.push(...staleSignals);

    // 5. Unresolved decision detection
    const decisionSignals = this.detectUnresolvedDecisions(state.hypotheses);
    signals.push(...decisionSignals);

    const summary = {
      total: signals.length,
      high: signals.filter((s) => s.severity === 'HIGH').length,
      medium: signals.filter((s) => s.severity === 'MEDIUM').length,
      low: signals.filter((s) => s.severity === 'LOW').length,
    };

    return {
      incidentId,
      detectedAt: new Date().toISOString(),
      signals,
      summary,
      conflicts: state.conflicts,
      openQuestions: state.openQuestions,
      unassignedActions: state.actions.filter((a) => !a.assigneeId),
      staleFacts: await this.getStaleFacts(incidentId, state.reportedObservations),
      unresolvedDecisions: this.getUnresolvedDecisions(state.hypotheses),
      unverifiedHypotheses: state.hypotheses.filter((h) => h.status === 'UNCONFIRMED'),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. CONFLICT DETECTION — deterministic + AI-assisted
  //
  // Uses LLM to identify candidate conflicts, then compares with
  // current state using application logic.
  // ─────────────────────────────────────────────────────────────────────────

  private detectConflictSignals(conflicts: ConflictSummary[]): UncertaintySignal[] {
    return conflicts
      .filter((c) => c.status === 'UNRESOLVED')
      .map((c) => ({
        kind: 'CONFLICT' as const,
        severity: 'HIGH' as const,
        topic: c.topic,
        description: `Conflicting claims: "${c.claimA.substring(0, 60)}..." vs "${c.claimB.substring(0, 60)}..."`,
        recommendation: `Clarify with monitoring data. Ask: "${this.buildConflictQuestion(c.topic, c.claimA, c.claimB)}"`,
        relatedEntityIds: [c.id],
        detectedAt: c.detectedAt,
      }));
  }

  /**
   * Deterministic conflict detection — compares a new fact against
   * all existing facts on the same topic. Returns conflicts found.
   */
  async detectConflictsDeterministic(
    incidentId: string,
    newFactTopic: string,
    newFactStatement: string
  ): Promise<Array<{ existingFact: FactSummary; conflict: { topic: string; claimA: string; claimB: string } }>> {
    const existingFacts = await factService.getFacts(incidentId);
    const conflicts: Array<{ existingFact: FactSummary; conflict: { topic: string; claimA: string; claimB: string } }> = [];

    for (const fact of existingFacts) {
      if (this.areContradictory(fact.title, fact.description, newFactTopic, newFactStatement)) {
        conflicts.push({
          existingFact: { ...fact, evidence: fact.evidence as unknown as EvidenceMetadata, createdAt: fact.createdAt.toISOString(), updatedAt: fact.updatedAt.toISOString() },
          conflict: {
            topic: newFactTopic,
            claimA: fact.description,
            claimB: newFactStatement,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * AI-assisted conflict detection — sends current state to LLM
   * to find candidate conflicts that deterministic rules may miss.
   */
  async detectConflictsAI(incidentId: string): Promise<UncertaintySignal[]> {
    const state = await incidentStateAggregationService.getIncidentState(incidentId);
    if (!state) return [];

    const stateText = this.compressState(state);

    try {
      const question = await aiProvider.generateClarificationQuestion(stateText);
      // If AI identifies a conflict, convert to signal
      if (question.questionText.toLowerCase().includes('conflict') || question.questionText.toLowerCase().includes('disagree')) {
        return [{
          kind: 'CONFLICT',
          severity: 'MEDIUM',
          topic: 'AI-detected potential conflict',
          description: question.questionText,
          recommendation: question.questionText,
          relatedEntityIds: [],
          detectedAt: new Date().toISOString(),
        }];
      }
    } catch {
      // AI unavailable — deterministic detection still works
    }

    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. MISSING INFORMATION — generates clarification questions
  //
  // Analyzes the incident state to find temporal gaps, missing data,
  // and unanswered causal questions.
  // ─────────────────────────────────────────────────────────────────────────

  private async detectMissingInformation(
    incidentId: string,
    state: Awaited<ReturnType<typeof incidentStateAggregationService.getIncidentState>>
  ): Promise<UncertaintySignal[]> {
    if (!state) return [];
    const signals: UncertaintySignal[] = [];

    // Check: Do we have a deployment event and a failure event?
    const hasDeployment = state.timeline.some((t) =>
      t.eventType === 'DEPLOYMENT' || t.description.toLowerCase().includes('deploy')
    );
    const hasFailure = state.reportedObservations.some((f) =>
      f.title.toLowerCase().includes('error') ||
      f.title.toLowerCase().includes('failure') ||
      f.title.toLowerCase().includes('outage')
    );

    if (hasDeployment && hasFailure) {
      // Check if we have the temporal relationship
      const deploymentEvent = state.timeline.find((t) =>
        t.eventType === 'DEPLOYMENT' || t.description.toLowerCase().includes('deploy')
      );
      const failureFact = state.reportedObservations.find((f) =>
        f.title.toLowerCase().includes('error') ||
        f.title.toLowerCase().includes('failure') ||
        f.title.toLowerCase().includes('outage')
      );

      // Check if there's a hypothesis linking them
      const hasLinkingHypothesis = state.hypotheses.some((h) =>
        h.description.toLowerCase().includes('deploy') &&
        (h.description.toLowerCase().includes('cause') || h.description.toLowerCase().includes('after'))
      );

      if (!hasLinkingHypothesis && deploymentEvent && failureFact) {
        signals.push({
          kind: 'MISSING_INFO',
          severity: 'HIGH',
          topic: 'Deployment-failure temporal relationship',
          description: `Deployment occurred (${deploymentEvent.eventTime}) and failures were reported, but no one has confirmed whether failures began immediately after deployment.`,
          recommendation: 'Ask: "Did the payment failures begin immediately after the deployment, or was there a delay?"',
          relatedEntityIds: [deploymentEvent.id, failureFact.id],
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check: Do we have monitoring data?
    const hasMonitoring = state.reportedObservations.some((f) =>
      f.evidence.sourceType === 'MONITORING'
    );
    if (!hasMonitoring && state.reportedObservations.length > 0) {
      signals.push({
        kind: 'MISSING_INFO',
        severity: 'MEDIUM',
        topic: 'No monitoring data',
        description: 'All observations are from human speakers. No monitoring system data has been reported.',
        recommendation: 'Ask: "Can someone pull the monitoring dashboards for error rates and latency during the incident window?"',
        relatedEntityIds: [],
        detectedAt: new Date().toISOString(),
      });
    }

    // Check: Do we know the blast radius?
    const hasBlastRadius = state.reportedObservations.some((f) =>
      f.description.toLowerCase().includes('affected') ||
      f.description.toLowerCase().includes('users') ||
      f.description.toLowerCase().includes('impact')
    );
    if (!hasBlastRadius) {
      signals.push({
        kind: 'MISSING_INFO',
        severity: 'MEDIUM',
        topic: 'Unknown blast radius',
        description: 'No information about customer impact or number of affected users.',
        recommendation: 'Ask: "What is the current customer impact? How many users are affected?"',
        relatedEntityIds: [],
        detectedAt: new Date().toISOString(),
      });
    }

    // Check: Do we have a timeline of events?
    if (state.timeline.length < 3 && state.reportedObservations.length > 2) {
      signals.push({
        kind: 'MISSING_INFO',
        severity: 'LOW',
        topic: 'Sparse timeline',
        description: `${state.reportedObservations.length} observations recorded but only ${state.timeline.length} timeline events.`,
        recommendation: 'Ensure key events are being logged to the timeline for post-mortem.',
        relatedEntityIds: [],
        detectedAt: new Date().toISOString(),
      });
    }

    return signals;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. UNCLEAR OWNERSHIP — flags unassigned actions
  // ─────────────────────────────────────────────────────────────────────────

  private detectUnclearOwnership(actions: ActionItemSummary[]): UncertaintySignal[] {
    const unassigned = actions.filter(
      (a) => !a.assigneeId && a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
    );

    return unassigned.map((a) => ({
      kind: 'UNASSIGNED_ACTION' as const,
      severity: 'MEDIUM' as const,
      topic: a.title,
      description: `Action "${a.title}" has no owner. ${a.description.substring(0, 80)}`,
      recommendation: `Assign someone to this action or mark as UNASSIGNED.`,
      relatedEntityIds: [a.id],
      detectedAt: a.createdAt,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. STALE INFORMATION — old/unverified facts
  //
  // Marks previous information as superseded when newer evidence exists
  // or when information is old without verification.
  // ─────────────────────────────────────────────────────────────────────────

  private async detectStaleInformation(
    incidentId: string,
    reportedObservations: FactSummary[]
  ): Promise<UncertaintySignal[]> {
    const signals: UncertaintySignal[] = [];
    const now = new Date();

    for (const fact of reportedObservations) {
      const evidence = fact.evidence as EvidenceMetadata;
      const factAge = now.getTime() - new Date(fact.createdAt).getTime();
      const ageMinutes = factAge / (1000 * 60);

      // Flag facts older than 15 minutes without verification
      if (ageMinutes > 15 && evidence.verificationStatus === 'UNVERIFIED') {
        signals.push({
          kind: 'STALE_INFO',
          severity: ageMinutes > 30 ? 'HIGH' : 'MEDIUM',
          topic: fact.title,
          description: `Fact "${fact.title}" was reported ${Math.round(ageMinutes)} minutes ago and has not been verified.`,
          recommendation: `Verify with monitoring data or ask ${evidence.speakerId || 'the speaker'} to re-confirm.`,
          relatedEntityIds: [fact.id],
          detectedAt: fact.createdAt,
        });
      }
    }

    // Check for facts that have been superseded by newer facts on same topic
    const topicGroups = new Map<string, FactSummary[]>();
    for (const fact of reportedObservations) {
      const key = fact.title.toLowerCase().trim();
      if (!topicGroups.has(key)) topicGroups.set(key, []);
      topicGroups.get(key)!.push(fact);
    }

    for (const [, facts] of topicGroups) {
      if (facts.length > 1) {
        // Sort by creation time
        facts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const older = facts.slice(0, -1);
        const newest = facts[facts.length - 1];

        for (const oldFact of older) {
          signals.push({
            kind: 'STALE_INFO',
            severity: 'LOW',
            topic: oldFact.title,
            description: `Fact "${oldFact.title}" may be superseded by newer report: "${newest.description.substring(0, 60)}..."`,
            recommendation: `Consider marking older fact as superseded.`,
            relatedEntityIds: [oldFact.id, newest.id],
            detectedAt: newest.createdAt,
          });
        }
      }
    }

    return signals;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. UNRESOLVED DECISIONS — suggestions without agreement
  // ─────────────────────────────────────────────────────────────────────────

  private detectUnresolvedDecisions(hypotheses: HypothesisSummary[]): UncertaintySignal[] {
    // Hypotheses that are candidates for root cause but not yet verified
    const rootCauseCandidates = hypotheses.filter((h) =>
      h.status === 'UNCONFIRMED' && (
        h.description.toLowerCase().includes('cause') ||
        h.description.toLowerCase().includes('because') ||
        h.description.toLowerCase().includes('due to')
      )
    );

    return rootCauseCandidates.map((h) => ({
      kind: 'UNRESOLVED_DECISION' as const,
      severity: 'HIGH' as const,
      topic: h.title,
      description: `Hypothesis "${h.title}" may be a root cause candidate but has not been verified or dismissed.`,
      recommendation: `Verify with evidence: "${this.buildHypothesisVerificationQuestion(h)}"`,
      relatedEntityIds: [h.id],
      detectedAt: h.createdAt,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Determine if two statements are contradictory
  // ─────────────────────────────────────────────────────────────────────────

  private areContradictory(
    topicA: string,
    statementA: string,
    topicB: string,
    statementB: string
  ): boolean {
    const normalA = topicA.toLowerCase().trim();
    const normalB = topicB.toLowerCase().trim();

    // Same topic but different statements
    if (normalA !== normalB && !normalA.includes(normalB) && !normalB.includes(normalA)) {
      return false; // Different topics — not a contradiction
    }

    const descA = statementA.toLowerCase().trim();
    const descB = statementB.toLowerCase().trim();

    if (descA === descB) return false; // Identical — not a contradiction

    // Check for semantic opposites (heuristic)
    const opposites = [
      ['high', 'low', 'normal'],
      ['degraded', 'healthy', 'normal'],
      ['failing', 'working', 'healthy'],
      ['exhausted', 'available', 'healthy'],
      ['timeout', 'responsive'],
      ['error', 'success'],
      ['increased', 'decreased', 'stable'],
    ];

    for (const group of opposites) {
      const aHasAny = group.some((w) => descA.includes(w));
      const bHasAny = group.some((w) => descB.includes(w));
      if (aHasAny && bHasAny) {
        // Check they don't have the SAME word from the group
        const aWords = group.filter((w) => descA.includes(w));
        const bWords = group.filter((w) => descB.includes(w));
        if (aWords.some((w) => !bWords.includes(w)) && bWords.some((w) => !aWords.includes(w))) {
          return true; // They have opposing words from the same group
        }
      }
    }

    // Fallback: if same topic and statements are significantly different
    return descA !== descB && !descA.includes(descB) && !descB.includes(descA);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Build a conflict clarification question
  // ─────────────────────────────────────────────────────────────────────────

  private buildConflictQuestion(topic: string, claimA: string, claimB: string): string {
    return `There are conflicting reports about ${topic}. One source says: "${claimA.substring(0, 50)}..." Another says: "${claimB.substring(0, 50)}..." Can someone verify with monitoring data?`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Build a hypothesis verification question
  // ─────────────────────────────────────────────────────────────────────────

  private buildHypothesisVerificationQuestion(hypothesis: HypothesisSummary): string {
    return `Is there evidence that "${hypothesis.title}" is the root cause? What monitoring data supports or contradicts this?`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Get stale facts with details
  // ─────────────────────────────────────────────────────────────────────────

  private async getStaleFacts(
    incidentId: string,
    reportedObservations: FactSummary[]
  ): Promise<StaleFactInfo[]> {
    const stale: StaleFactInfo[] = [];
    const now = new Date();

    for (const fact of reportedObservations) {
      const evidence = fact.evidence as EvidenceMetadata;
      const factAge = now.getTime() - new Date(fact.createdAt).getTime();
      const ageMinutes = factAge / (1000 * 60);

      if (ageMinutes > 10 && evidence.verificationStatus === 'UNVERIFIED') {
        stale.push({
          fact,
          reason: ageMinutes > 30
            ? `Reported ${Math.round(ageMinutes)} minutes ago, unverified`
            : `Reported ${Math.round(ageMinutes)} minutes ago, may need re-confirmation`,
        });
      }
    }

    return stale;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Get unresolved decisions
  // ─────────────────────────────────────────────────────────────────────────

  private getUnresolvedDecisions(hypotheses: HypothesisSummary[]): UnresolvedDecisionInfo[] {
    return hypotheses
      .filter((h) => h.status === 'UNCONFIRMED')
      .map((h) => ({
        topic: h.title,
        lastMentioned: h.updatedAt,
        context: h.description.substring(0, 100),
      }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Compress state for AI prompt
  // ─────────────────────────────────────────────────────────────────────────

  private compressState(state: Awaited<ReturnType<typeof incidentStateAggregationService.getIncidentState>>): string {
    if (!state) return 'No incident state available.';

    const lines = [
      `Incident: ${state.title} (${state.severity})`,
      `Status: ${state.currentStatus}`,
      '',
      `Confirmed Facts (${state.confirmedFacts.length}):`,
      ...state.confirmedFacts.map((f) => `  - ${f.title}: ${f.description.substring(0, 60)}`),
      '',
      `Reported Observations (${state.reportedObservations.length}):`,
      ...state.reportedObservations.map((f) => `  - [${f.status}] ${f.title}: ${f.description.substring(0, 60)}`),
      '',
      `Hypotheses (${state.hypotheses.length}):`,
      ...state.hypotheses.map((h) => `  - [${h.status}] ${h.title}: ${h.description.substring(0, 60)}`),
      '',
      `Conflicts (${state.conflicts.length}):`,
      ...state.conflicts.map((c) => `  - [${c.status}] ${c.topic}: ${c.claimA.substring(0, 40)} vs ${c.claimB.substring(0, 40)}`),
      '',
      `Open Questions (${state.openQuestions.filter((q) => !q.resolved).length}):`,
      ...state.openQuestions.filter((q) => !q.resolved).map((q) => `  - ${q.title}`),
      '',
      `Actions (${state.actions.length}):`,
      ...state.actions.map((a) => `  - [${a.status}] ${a.title} (owner: ${a.assigneeName || 'UNASSIGNED'})`),
    ];

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Empty dashboard
  // ─────────────────────────────────────────────────────────────────────────

  private emptyDashboard(incidentId: string): UncertaintyDashboard {
    return {
      incidentId,
      detectedAt: new Date().toISOString(),
      signals: [],
      summary: { total: 0, high: 0, medium: 0, low: 0 },
      conflicts: [],
      openQuestions: [],
      unassignedActions: [],
      staleFacts: [],
      unresolvedDecisions: [],
      unverifiedHypotheses: [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-generate ownership question for unassigned actions
  // ─────────────────────────────────────────────────────────────────────────

  async generateOwnershipQuestion(
    incidentId: string,
    actionId: string
  ): Promise<string | null> {
    const actions = await actionsService.getActions(incidentId);
    const action = actions.find((a) => a.id === actionId);
    if (!action || action.assigneeId) return null;

    const question = await openQuestionService.askQuestion(
      incidentId,
      `Who owns: ${action.title}?`,
      `Action "${action.title}" needs an owner. ${action.description.substring(0, 80)}`,
      {
        sourceType: 'MANUAL_CONFIRMATION',
        sourceText: `Auto-generated: unassigned action detected`,
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        verificationStatus: 'UNVERIFIED',
      }
    );

    return question.id;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mark fact as superseded
  // ─────────────────────────────────────────────────────────────────────────

  async markSuperseded(
    factId: string,
    supersededBy: string,
    reason: string
  ): Promise<void> {
    const fact = await prisma.fact.findUnique({ where: { id: factId } });
    if (!fact) return;

    const currentEvidence = fact.evidence as unknown as EvidenceMetadata;
    const updatedEvidence: EvidenceMetadata = {
      ...currentEvidence,
      verificationStatus: 'DISPUTED',
      sourceText: `${currentEvidence.sourceText || ''} [SUPERSEDED: ${reason}]`,
    };

    await prisma.fact.update({
      where: { id: factId },
      data: {
        status: 'CONFLICTING',
        evidence: updatedEvidence as any,
      },
    });

    await timelineService.addEvent(
      fact.incidentId,
      'FACT_SUPERSEDED',
      `Fact "${fact.title}" marked as superseded: ${reason}`,
      updatedEvidence,
      `Fact:${factId}`,
      1.0,
      new Date()
    );
  }
}

export const uncertaintyService = new UncertaintyService();
