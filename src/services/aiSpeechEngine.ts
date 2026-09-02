import { IncidentState, ConflictSummary, DecisionSummary, ActionItemSummary } from '@/types/incident';

// ─────────────────────────────────────────────────────────────────────────────
// AI Spoken Participation — Speech Engine (pure, deterministic)
//
// Decides WHEN the AI Incident Commander should speak and composes WHAT it says.
//
// Rules engine goals:
//   - The AI must NOT talk after every transcript.
//   - It speaks only when a meaningful trigger fires (conflict, decision,
//     action, approval, state change, explicit status request, periodic check).
//   - Voice personality: professional, calm, concise, non-authoritative,
//     evidence-aware. Never declare a root cause; always attribute uncertainty.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Triggers ────────────────────────────────────────────────────────────────

export type AISpeechTrigger =
  | 'CONFLICT_DETECTED'
  | 'DECISION_DISCUSSED'
  | 'ACTION_ASSIGNED'
  | 'CRITICAL_ACTION_CONFIRMATION'
  | 'INCIDENT_STATE_CHANGE'
  | 'USER_REQUESTED_STATUS'
  | 'PERIODIC_STATUS';

export const ALL_TRIGGERS: AISpeechTrigger[] = [
  'CONFLICT_DETECTED',
  'DECISION_DISCUSSED',
  'ACTION_ASSIGNED',
  'CRITICAL_ACTION_CONFIRMATION',
  'INCIDENT_STATE_CHANGE',
  'USER_REQUESTED_STATUS',
  'PERIODIC_STATUS',
];

/**
 * Priority used to pick ONE ideal utterance when several triggers fire at once.
 * Conflicts and critical approvals are the most important things to voice.
 */
export const TRIGGER_PRIORITY: Record<AISpeechTrigger, number> = {
  CONFLICT_DETECTED: 100,
  CRITICAL_ACTION_CONFIRMATION: 90,
  DECISION_DISCUSSED: 80,
  ACTION_ASSIGNED: 70,
  INCIDENT_STATE_CHANGE: 60,
  USER_REQUESTED_STATUS: 50,
  PERIODIC_STATUS: 40,
};

// ─── Intent ──────────────────────────────────────────────────────────────────

export interface SpeechIntent {
  trigger: AISpeechTrigger;
  /** Higher = more important; engine speaks the single highest-priority intent. */
  priority: number;
  /** The exact utterance to speak. */
  text: string;
  /** Reference to the entity that caused the utterance (conflict/action/…) id. */
  entityId?: string;
  category: 'ALERT' | 'CONFIRMATION' | 'STATUS_SUMMARY';
}

export interface SpeechEvaluationContext {
  /** Pending approval requests that are new since the previous evaluation. */
  newApprovals?: Array<{ id: string; actionTitle: string; actionDetails: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger evaluation
//
// `evaluateForSpeech(prev, next)` is a pure function: given the previous
// incident state snapshot and the current one, it decides whether the AI should
// speak and returns a single high-priority SpeechIntent (or null).
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateForSpeech(
  prev: IncidentState | null,
  next: IncidentState,
  ctx: SpeechEvaluationContext = {}
): SpeechIntent | null {
  const intents: SpeechIntent[] = [];

  // 1. Major conflict detected
  const conflict = detectNewConflict(prev, next);
  if (conflict) {
    intents.push({
      trigger: 'CONFLICT_DETECTED',
      priority: TRIGGER_PRIORITY.CONFLICT_DETECTED,
      text: phraseConflict(conflict),
      entityId: conflict.id,
      category: 'ALERT',
    });
  }

  // 2. Critical decision being discussed
  const decision = detectNewCriticalDecision(prev, next);
  if (decision) {
    intents.push({
      trigger: 'DECISION_DISCUSSED',
      priority: TRIGGER_PRIORITY.DECISION_DISCUSSED,
      text: phraseDecision(decision),
      entityId: decision.id,
      category: 'ALERT',
    });
  }

  // 3. Important action assigned
  const action = detectNewAssignedAction(prev, next);
  if (action) {
    intents.push({
      trigger: 'ACTION_ASSIGNED',
      priority: TRIGGER_PRIORITY.ACTION_ASSIGNED,
      text: phraseAction(action),
      entityId: action.id,
      category: 'CONFIRMATION',
    });
  }

  // 4. Critical action requires confirmation
  const approval = (ctx.newApprovals || [])[0];
  if (approval) {
    intents.push({
      trigger: 'CRITICAL_ACTION_CONFIRMATION',
      priority: TRIGGER_PRIORITY.CRITICAL_ACTION_CONFIRMATION,
      text: phraseCriticalConfirmation(approval.actionTitle, approval.actionDetails),
      entityId: approval.id,
      category: 'ALERT',
    });
  }

  // 5. Significant incident state change
  const stateChange = detectSignificantStateChange(prev, next);
  if (stateChange) {
    intents.push({
      trigger: 'INCIDENT_STATE_CHANGE',
      priority: TRIGGER_PRIORITY.INCIDENT_STATE_CHANGE,
      text: phraseStateChange(stateChange.from, stateChange.to),
      category: 'ALERT',
    });
  }

  if (intents.length === 0) return null;

  // Speak the single most important thing — never a wall of alerts at once.
  return intents.sort((a, b) => b.priority - a.priority)[0];
}

/**
 * Builds an explicit USER_REQUESTED_STATUS intent from the current state.
 * Used when a participant asks for a status update.
 */
export function buildStatusRequestIntent(next: IncidentState): SpeechIntent {
  return {
    trigger: 'USER_REQUESTED_STATUS',
    priority: TRIGGER_PRIORITY.USER_REQUESTED_STATUS,
    text: formatStatusSummary(next),
    category: 'STATUS_SUMMARY',
  };
}

/**
 * Builds a PERIODIC_STATUS intent. A truncation guard keeps it under ~30s.
 */
export function buildPeriodicStatusIntent(next: IncidentState): SpeechIntent {
  return {
    trigger: 'PERIODIC_STATUS',
    priority: TRIGGER_PRIORITY.PERIODIC_STATUS,
    text: truncateForSpeech(formatStatusSummary(next), 500),
    category: 'STATUS_SUMMARY',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Detectors (deliberately conservative — no speech on routine transcripts)
// ─────────────────────────────────────────────────────────────────────────────

function detectNewConflict(prev: IncidentState | null, next: IncidentState): ConflictSummary | null {
  if (!prev) return null;
  const prevIds = new Set(prev.conflicts.map((c) => c.id));
  const fresh = next.conflicts.find(
    (c) => !prevIds.has(c.id) && c.status === 'UNRESOLVED'
  );
  return fresh || null;
}

function detectNewCriticalDecision(prev: IncidentState | null, next: IncidentState): DecisionSummary | null {
  if (!prev) return null;
  const prevIds = new Set(prev.decisions.map((d) => d.id));
  const fresh = next.decisions.filter((d) => !prevIds.has(d.id));

  for (const decision of fresh) {
    if (isCriticalWording(decision.title) || isCriticalWording(decision.description)) {
      return decision;
    }
  }
  // At SEV1/SEV2 every new decision is material enough to voice.
  if (next.severity === 'SEV1' || next.severity === 'SEV2') {
    return fresh[0] || null;
  }
  return null;
}

function detectNewAssignedAction(prev: IncidentState | null, next: IncidentState): ActionItemSummary | null {
  if (!prev) return null;
  const prevIds = new Set(prev.actions.map((a) => a.id));
  const fresh = next.actions.filter((a) => !prevIds.has(a.id));

  for (const action of fresh) {
    if (action.assigneeName) return action;
  }
  // Important even when unassigned at high severity.
  if (next.severity === 'SEV1' || next.severity === 'SEV2') {
    return fresh[0] || null;
  }
  return null;
}

function detectSignificantStateChange(
  prev: IncidentState | null,
  next: IncidentState
): { from: string; to: string } | null {
  if (!prev) return null;
  if (prev.currentStatus !== next.currentStatus) {
    return { from: prev.currentStatus, to: next.currentStatus };
  }
  if (prev.severity !== next.severity) {
    return { from: `${prev.severity}`, to: `${next.severity}` };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice personality — phrasing
// ─────────────────────────────────────────────────────────────────────────────

/** Wording for "root cause" style claims is banned. Hypotheses stay hypotheses. */

export function phraseConflict(conflict: ConflictSummary): string {
  const topic = friendlyTopic(conflict.topic);
  const claimA = shortQuote(conflict.claimA);
  const claimB = shortQuote(conflict.claimB);
  return [
    `I've detected conflicting reports about ${topic}.`,
    `One source says: ${claimA}. Another says: ${claimB}.`,
    `Can someone confirm the current monitoring value?`,
  ].join(' ');
}

export function phraseDecision(decision: DecisionSummary): string {
  const topic = friendlyTopic(decision.title);
  const decidedBy = decision.decidedBy || 'the bridge';
  return [
    `A decision is being discussed: ${topic}.`,
    `This was proposed by ${decidedBy}, and has been logged.`,
    `Confirming before we treat it as agreed.`,
  ].join(' ');
}

export function phraseAction(action: ActionItemSummary): string {
  const topic = friendlyTopic(action.title);
  if (action.assigneeName) {
    return `Action item assigned: ${topic}. ${action.assigneeName} is the owner. This action has been logged.`;
  }
  return `Action item logged: ${topic}. It does not have an owner yet and needs to be assigned.`;
}

export function phraseCriticalConfirmation(actionTitle: string, _details: string): string {
  const topic = friendlyTopic(actionTitle);
  void _details;
  return [
    `Attention: a critical action requires confirmation. ${topic}.`,
    `This is a disruptive production change and will not be executed automatically.`,
    `An incident commander must approve before we proceed.`,
  ].join(' ');
}

export function phraseStateChange(from: string, to: string): string {
  return `Incident status has changed from ${friendlyTopic(from)} to ${friendlyTopic(to)}. I'll keep tracking the situation.`;
}

export function phraseMissingEvidence(topic: string): string {
  return `We do not yet have enough evidence to determine the cause of ${friendlyTopic(topic)}. One active hypothesis is being evaluated, but nothing is confirmed.`;
}

export function phraseHypothesis(description: string): string {
  return `One active hypothesis is: ${shortQuote(description)}. It has not been confirmed yet.`;
}

export function phraseAllClear(): string {
  return `The situation appears to be stabilizing. I have no new alerts to report.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status summary — concise, < ~30 seconds spoken
//
// Format:
//   Confirmed:
//   ...
//
//   Active hypotheses:
//   ...
//
//   Actions:
//   ...
//
//   Unresolved:
//   ...
// ─────────────────────────────────────────────────────────────────────────────

export function formatStatusSummary(state: IncidentState): string {
  const confirmed = state.confirmedFacts.map((f) => `Confirmed fact: ${shorten(f.description, 90)}.`).join(' ');
  const hypotheses =
    state.hypotheses
      .filter((h) => h.status !== 'CONFIRMED')
      .map((h) => `Hypothesis: ${shorten(h.description, 90)}.`)
      .join(' ') || 'No active hypotheses.';

  const actions =
    state.actions
      .filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
      .slice(0, 5)
      .map((a) => `${shorten(friendlyTopic(a.title), 60)}. Owner: ${a.assigneeName || 'unassigned'}.`)
      .join(' ') || 'No outstanding actions.';

  const unresolved: string[] = [];
  for (const c of state.conflicts.filter((x) => x.status === 'UNRESOLVED').slice(0, 3)) {
    unresolved.push(`Conflicting reports on ${friendlyTopic(c.topic)}.`);
  }
  for (const q of state.openQuestions.filter((x) => !x.resolved).slice(0, 3)) {
    unresolved.push(`Open question: ${shorten(friendlyTopic(q.title), 70)}.`);
  }
  const unresolvedText = unresolved.join(' ') || 'No unresolved conflicts or questions.';

  return [
    `Status update for ${shorten(state.title, 60)}.`,
    ``,
    `Confirmed: ${confirmed || 'No confirmed facts yet.'}`,
    ``,
    `Active hypotheses: ${hypotheses}`,
    ``,
    `Actions: ${actions}`,
    ``,
    `Unresolved: ${unresolvedText}`,
  ]
    .join('\n')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function friendlyTopic(topic: string): string {
  const t = (topic || '').trim();
  if (!t) return 'the situation';
  // Lowercase mid-sentence topic names unless they are clear acronyms.
  const cleaned = t.length >= 2 && t === t.toUpperCase() ? t : t.charAt(0).toLowerCase() + t.slice(1);
  return cleaned.replace(/:$/, '');
}

function shortQuote(text: string): string {
  const t = (text || '').trim().replace(/^["']|["']$/g, '');
  return shorten(t, 90);
}

function shorten(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).replace(/\s+$/, '')}…`;
}

function truncateForSpeech(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+$/, '')}…`;
}

const CRITICAL_WORDS = [
  'rollback', 'restart', 'failover', 'drop ', 'drop database', 'disable',
  'shut down', 'scale down', 'terminate', 'delete', 'redeploy', 'rewrite',
  'force', 'block', 'freeze', 'reboot',
];

function isCriticalWording(text: string): boolean {
  const t = (text || '').toLowerCase();
  return CRITICAL_WORDS.some((w) => t.includes(w));
}

export const aiSpeechEngine = { evaluateForSpeech, buildStatusRequestIntent, buildPeriodicStatusIntent };
export default aiSpeechEngine;