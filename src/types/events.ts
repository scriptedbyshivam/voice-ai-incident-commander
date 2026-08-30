import {
  IncidentState,
  ParticipantSummary,
  FactSummary,
  HypothesisSummary,
  DecisionSummary,
  ActionItemSummary,
  ConflictSummary,
  OpenQuestionSummary,
  TimelineEventSummary,
} from './incident';

export interface TranscriptPayload {
  id: string;
  incidentId: string;
  speakerName: string;
  text: string;
  timestamp: string;
}

export interface ApprovalPayload {
  id: string;
  incidentId: string;
  actionTitle: string;
  actionDetails: string;
  requestedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string | null;
  rejectedBy?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

export interface RealtimeEventMap {
  'incident.updated': { state: IncidentState };
  'participant.joined': { participant: ParticipantSummary };
  'participant.left': { participant: ParticipantSummary };
  'transcript.created': { transcript: TranscriptPayload };
  'fact.created': { fact: FactSummary };
  'fact.updated': { fact: FactSummary };
  'hypothesis.created': { hypothesis: HypothesisSummary };
  'decision.created': { decision: DecisionSummary };
  'action.created': { action: ActionItemSummary };
  'action.updated': { action: ActionItemSummary };
  'conflict.detected': { conflict: ConflictSummary };
  'question.created': { question: OpenQuestionSummary };
  'timeline.updated': { timeline: TimelineEventSummary[] };
  'approval.required': { approval: ApprovalPayload };
  'approval.completed': { approval: ApprovalPayload };
  'ai.speaking': { speaking: boolean; audioUrl?: string | null; text?: string | null };
  'ai.status.updated': { statusText: string; isAnalyzing: boolean };
}

export type RealtimeEventName = keyof RealtimeEventMap;

export interface RealtimeEventEnvelope<T extends RealtimeEventName> {
  event: T;
  payload: RealtimeEventMap[T];
  timestamp: string;
}
