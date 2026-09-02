export type SourceType =
  | 'HUMAN_SPOKEN'
  | 'MONITORING'
  | 'DEPLOYMENT_SYSTEM'
  | 'SLACK'
  | 'JIRA'
  | 'PAGERDUTY'
  | 'MANUAL_CONFIRMATION'
  | 'APPROVAL'
  | 'INTEGRATION'
  | 'AUTO_DETECTED';

export interface EvidenceMetadata {
  sourceType: SourceType;
  sourceId?: string; // e.g. Slack message ID, monitoring alert ID, transcript chunk ID
  sourceText?: string; // original raw text/data snippet
  speakerId?: string; // user ID or participant ID if source is spoken
  timestamp: string; // ISO date string when evidence was generated
  confidence: number; // 0.0 to 1.0 confidence score
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED';
}

export type IncidentStatus = 'ACTIVE' | 'RESOLVED' | 'CLOSED';
export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

export type ParticipantRole =
  | 'INCIDENT_COMMANDER'
  | 'ENGINEER'
  | 'SRE'
  | 'SUPPORT'
  | 'PRODUCT'
  | 'BUSINESS'
  | 'OBSERVER';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: ParticipantRole;
}

export interface ParticipantSummary {
  id: string;
  userId: string;
  name: string;
  role: ParticipantRole;
  joinedAt: string;
  leftAt?: string | null;
}

export interface FactSummary {
  id: string;
  title: string;
  description: string;
  status: 'CONFIRMED' | 'REPORTED' | 'UNCONFIRMED' | 'CONFLICTING';
  evidence: EvidenceMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface HypothesisSummary {
  id: string;
  title: string;
  description: string;
  status: 'CONFIRMED' | 'REPORTED' | 'UNCONFIRMED' | 'CONFLICTING';
  evidence: EvidenceMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionSummary {
  id: string;
  title: string;
  description: string;
  decidedBy: string; // Name or ID
  evidence: EvidenceMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ActionStatusHistorySummary {
  id: string;
  oldStatus: 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  newStatus: 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  changedBy: string;
  notes?: string;
  createdAt: string;
}

export interface ActionItemSummary {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueAt?: string;
  blockedReason?: string;
  completionNotes?: string;
  history?: ActionStatusHistorySummary[];
  evidence: EvidenceMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictSummary {
  id: string;
  topic: string;
  claimA: string;
  claimB: string;
  sourceA: EvidenceMetadata;
  sourceB: EvidenceMetadata;
  status: string;
  detectedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenQuestionSummary {
  id: string;
  title: string;
  description: string;
  resolved: boolean;
  evidence: EvidenceMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface AiUtteranceSummary {
  id: string;
  text: string;
  trigger: string;
  category: 'ALERT' | 'CONFIRMATION' | 'STATUS_SUMMARY';
  audioUrl: string | null;
  audioFormat: string | null;
  durationSeconds: number | null;
  ttsProvider: string | null;
  createdAt: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalRequestSummary {
  id: string;
  actionId: string | null;
  actionTitle: string;
  actionDetails: string;
  requestedBy: string;
  status: ApprovalStatus;
  approvedBy: string | null;
  rejectedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  evidence: EvidenceMetadata | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  incidentId: string;
  eventType: TimelineEventType;
  description: string;
  sourceType: SourceType;
  sourceId: string | null;
  speaker: string | null;
  speakerRole: string | null;
  confidence: number;
  relatedEntity: string | null;
  timestamp: string;
  createdAt: string;
}

export interface TimelineEventSummary {
  id: string;
  eventType: string;
  description: string;
  eventTime: string;
  evidence: EvidenceMetadata;
  createdAt: string;
  sourceType: string;
  sourceId: string | null;
  speaker: string | null;
  confidence: number;
  relatedEntity: string | null;
}

export type TimelineEventType =
  | 'ALERT'
  | 'OBSERVATION'
  | 'FACT'
  | 'HYPOTHESIS'
  | 'CONFLICT'
  | 'DECISION'
  | 'ACTION_CREATED'
  | 'ACTION_UPDATED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'INTEGRATION_EVENT'
  | 'STATUS_CHANGE'
  | 'RESOLUTION'
  | 'FACT_VERIFIED'
  | 'HYPOTHESIS_VERIFIED'
  | 'CONFLICT_RESOLVED'
  | 'QUESTION_RESOLVED'
  | 'ACTION_REASSIGNED'
  | 'CRITICAL_ACTION_FLAGGED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'INCIDENT_CREATED'
  | 'FACT_SUPERSEDED'
  | 'EVIDENCE_ADDED';

export interface IncidentState {
  incidentId: string;
  title: string;
  description?: string | null;
  currentStatus: IncidentStatus;
  severity: Severity;
  createdAt: string;
  participants: ParticipantSummary[];
  confirmedFacts: FactSummary[];
  reportedObservations: FactSummary[];
  hypotheses: HypothesisSummary[];
  decisions: DecisionSummary[];
  actions: ActionItemSummary[];
  conflicts: ConflictSummary[];
  openQuestions: OpenQuestionSummary[];
  unresolvedRisks: string[];
  approvals: ApprovalRequestSummary[];
  timeline: TimelineEventSummary[];
  latestSummary?: string | null;
}
