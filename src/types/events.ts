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
  speakerId?: string;
  speakerName: string;
  speakerRole?: string;
  text: string;
  timestamp: string;
  startTime?: number;
  endTime?: number;
  confidence?: number;
  isFinal: boolean;
}

export interface ApprovalPayload {
  id: string;
  incidentId: string;
  actionId: string | null;
  actionTitle: string;
  actionDetails: string;
  requestedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  approvedBy?: string | null;
  rejectedBy?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  expiresAt?: string | null;
}

export interface RealtimeEventMap {
  'incident.updated': { state: IncidentState };
  'participant.joined': { participant: ParticipantSummary };
  'participant.left': { participant: ParticipantSummary };
  'transcript.created': { transcript: TranscriptPayload };
  'transcript.partial': { transcript: TranscriptPayload };
  'transcript.final': { transcript: TranscriptPayload };
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
  'analysis.completed': {
    incidentId: string;
    summary: AnalysisRunSummary;
  };
  'analysis.failed': {
    incidentId: string;
    error: string;
  };
}

// Summary of a single analysis run returned/emitted after persistence.
export interface AnalysisRunSummary {
  runId: string;
  incidentId: string;
  transcriptId?: string | null;
  transcriptText: string;
  model: string;
  extractedCounts: {
    facts: number;
    observations: number;
    hypotheses: number;
    decisions: number;
    actions: number;
    questions: number;
    risks: number;
    potentialConflicts: number;
  };
  persisted: {
    kind: string;
    entityId?: string | undefined;
    skipped?: boolean;
    reason?: string;
  }[];
  createdAt: string;
}

export type RealtimeEventName = keyof RealtimeEventMap;

export interface RealtimeEventEnvelope<T extends RealtimeEventName> {
  event: T;
  payload: RealtimeEventMap[T];
  timestamp: string;
}
