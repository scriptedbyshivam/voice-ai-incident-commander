import { SourceType } from '@/types/incident';

// ─────────────────────────────────────────────────────────────────────────────
// Incident Event Types
//
// These are the canonical input events that the Incident State Engine processes.
// Each event carries enough context to update the incident's canonical state.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventSource {
  type: SourceType;
  speakerId?: string;
  speakerName?: string;
  speakerRole?: string;
  transcriptId?: string;
  timestamp: string;
  confidence: number;
}

export interface ObservationEvent {
  kind: 'OBSERVATION';
  topic: string;
  statement: string;
  source: EventSource;
}

export interface FactReportEvent {
  kind: 'FACT_REPORT';
  topic: string;
  statement: string;
  source: EventSource;
  /** Only CONFIRMED if explicitly verified by a human. Otherwise REPORTED. */
  claimedStatus?: 'REPORTED' | 'CONFIRMED';
}

export interface HypothesisEvent {
  kind: 'HYPOTHESIS';
  topic: string;
  statement: string;
  source: EventSource;
  /** Related facts or observations that support this hypothesis. */
  supportingEvidence?: string[];
}

export interface DecisionEvent {
  kind: 'DECISION';
  topic: string;
  statement: string;
  source: EventSource;
  /** The person(s) who explicitly agreed. Empty = no decision yet. */
  agreedBy?: string[];
}

export interface ActionAssignmentEvent {
  kind: 'ACTION_ASSIGNMENT';
  topic: string;
  statement: string;
  source: EventSource;
  /** Who owns this action. If unclear, set to 'UNASSIGNED'. */
  assignee: string;
  /** Whether this is a critical action requiring approval. */
  isCritical?: boolean;
}

export interface QuestionEvent {
  kind: 'QUESTION';
  topic: string;
  statement: string;
  source: EventSource;
}

export interface ConflictReportEvent {
  kind: 'CONFLICT_REPORT';
  topic: string;
  claimA: string;
  claimB: string;
  sourceA: EventSource;
  sourceB: EventSource;
}

export interface RiskEvent {
  kind: 'RISK';
  topic: string;
  statement: string;
  source: EventSource;
}

export interface EvidenceUpdateEvent {
  kind: 'EVIDENCE_UPDATE';
  /** The entity type to update. */
  entityType: 'FACT' | 'HYPOTHESIS' | 'ACTION' | 'CONFLICT' | 'QUESTION';
  /** The entity ID to update. */
  entityId: string;
  /** The new evidence to attach. */
  source: EventSource;
  /** Optional new status. */
  newStatus?: string;
  /** Optional notes. */
  notes?: string;
}

export type IncidentEvent =
  | ObservationEvent
  | FactReportEvent
  | HypothesisEvent
  | DecisionEvent
  | ActionAssignmentEvent
  | QuestionEvent
  | ConflictReportEvent
  | RiskEvent
  | EvidenceUpdateEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Processing Result
// ─────────────────────────────────────────────────────────────────────────────

export interface EventProcessingResult {
  /** The event kind that was processed. */
  kind: string;
  /** Whether this event resulted in a state change. */
  stateChanged: boolean;
  /** What was created, updated, or skipped. */
  actions: StateAction[];
  /** Realtime events to emit. */
  emittedEvents: EmittedEvent[];
}

export interface StateAction {
  operation: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'CONFLICT_DETECTED';
  entityType: string;
  entityId?: string;
  reason: string;
}

export interface EmittedEvent {
  eventName: string;
  payload: Record<string, unknown>;
}
