import { IncidentState, Severity } from '@/types/incident';

export interface IncidentHealthMetrics {
  mttaSeconds: number;
  durationMinutes: number;
  severityWeight: number;
  unresolvedRiskScore: number;
  triageVelocityScore: number; // Percentage score (0-100)
}

export function calculateIncidentMetrics(state: IncidentState): IncidentHealthMetrics {
  const createdAtMs = new Date(state.createdAt).getTime();
  const nowMs = Date.now();
  const durationMinutes = Math.max(1, Math.round((nowMs - createdAtMs) / (1000 * 60)));

  // Severity Weight mapping
  const severityWeights: Record<Severity, number> = {
    SEV1: 100,
    SEV2: 70,
    SEV3: 40,
    SEV4: 15,
  };
  const severityWeight = severityWeights[state.severity] || 50;

  // Unresolved Risk Score: (open questions * 10) + (conflicts * 25)
  const unresolvedQuestionsCount = (state.openQuestions || []).filter((q) => !q.resolved).length;
  const unresolvedConflictsCount = (state.conflicts || []).filter((c) => c.status !== 'RESOLVED').length;
  const unresolvedRiskScore = Math.min(100, (unresolvedQuestionsCount * 10) + (unresolvedConflictsCount * 25));

  // Triage Velocity Score: proportion of confirmed facts + completed actions
  const totalFacts = (state.confirmedFacts || []).length + (state.reportedObservations || []).length;
  const verifiedFacts = (state.confirmedFacts || []).length;
  const factRatio = totalFacts > 0 ? verifiedFacts / totalFacts : 1;

  const totalActions = (state.actions || []).length;
  const completedActions = (state.actions || []).filter((a) => a.status === 'COMPLETED').length;
  const actionRatio = totalActions > 0 ? completedActions / totalActions : 1;

  const triageVelocityScore = Math.round(((factRatio * 0.5) + (actionRatio * 0.5)) * 100);

  return {
    mttaSeconds: Math.min(300, Math.round((nowMs - createdAtMs) / 1000)),
    durationMinutes,
    severityWeight,
    unresolvedRiskScore,
    triageVelocityScore,
  };
}
