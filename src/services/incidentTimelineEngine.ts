import prisma from '@/lib/db';
import { TimelineEvent, TimelineEventType, TimelineEventSummary, EvidenceMetadata } from '@/types/incident';
import { SourceType } from '@/types/incident';
import { realtimeEventHub } from './eventHub';

// ─────────────────────────────────────────────────────────────────────────────
// Valid event type registry
// ─────────────────────────────────────────────────────────────────────────────

const VALID_EVENT_TYPES: Set<string> = new Set([
  'ALERT', 'OBSERVATION', 'FACT', 'HYPOTHESIS', 'CONFLICT', 'DECISION',
  'ACTION_CREATED', 'ACTION_UPDATED', 'APPROVAL_REQUESTED', 'APPROVAL_GRANTED',
  'APPROVAL_REJECTED', 'INTEGRATION_EVENT', 'STATUS_CHANGE', 'RESOLUTION',
  'FACT_VERIFIED', 'HYPOTHESIS_VERIFIED', 'CONFLICT_RESOLVED', 'QUESTION_RESOLVED',
  'ACTION_REASSIGNED', 'CRITICAL_ACTION_FLAGGED', 'PARTICIPANT_JOINED',
  'PARTICIPANT_LEFT', 'INCIDENT_CREATED', 'FACT_SUPERSEDED', 'EVIDENCE_ADDED',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Source type validation per event category
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SOURCE_TYPES: Set<SourceType> = new Set([
  'HUMAN_SPOKEN', 'MONITORING', 'DEPLOYMENT_SYSTEM', 'SLACK', 'JIRA',
  'PAGERDUTY', 'MANUAL_CONFIRMATION', 'APPROVAL', 'INTEGRATION', 'AUTO_DETECTED',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Event type → allowed source type mapping
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_SOURCE_MAP: Record<string, SourceType[]> = {
  ALERT: ['MONITORING', 'PAGERDUTY', 'INTEGRATION', 'AUTO_DETECTED'],
  OBSERVATION: ['HUMAN_SPOKEN', 'MONITORING', 'DEPLOYMENT_SYSTEM', 'SLACK', 'JIRA'],
  FACT: ['HUMAN_SPOKEN', 'MONITORING', 'MANUAL_CONFIRMATION', 'AUTO_DETECTED'],
  HYPOTHESIS: ['HUMAN_SPOKEN', 'AUTO_DETECTED'],
  CONFLICT: ['HUMAN_SPOKEN', 'MONITORING', 'AUTO_DETECTED'],
  DECISION: ['HUMAN_SPOKEN'],
  ACTION_CREATED: ['HUMAN_SPOKEN', 'AUTO_DETECTED'],
  ACTION_UPDATED: ['HUMAN_SPOKEN'],
  APPROVAL_REQUESTED: ['HUMAN_SPOKEN', 'AUTO_DETECTED'],
  APPROVAL_GRANTED: ['HUMAN_SPOKEN'],
  APPROVAL_REJECTED: ['HUMAN_SPOKEN'],
  INTEGRATION_EVENT: ['INTEGRATION', 'SLACK', 'JIRA'],
  STATUS_CHANGE: ['HUMAN_SPOKEN', 'MANUAL_CONFIRMATION', 'AUTO_DETECTED'],
  RESOLUTION: ['HUMAN_SPOKEN', 'MANUAL_CONFIRMATION', 'MONITORING'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineFilter {
  order?: 'latest' | 'chronological';
  eventType?: string;
  sourceType?: string;
  limit?: number;
  offset?: number;
  fromTimestamp?: string;
  toTimestamp?: string;
}

export interface TimelinePage {
  events: TimelineEventSummary[];
  total: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Incident Timeline Engine
//
// Single source of truth for all timeline events.
// Every meaningful incident event must pass through this engine.
// ─────────────────────────────────────────────────────────────────────────────

export class IncidentTimelineEngine {
  // ───────────────────────────────────────────────────────────────────────
  // Create a timeline event with full validation
  // ───────────────────────────────────────────────────────────────────────

  async createEvent(params: CreateEventParams): Promise<TimelineEvent> {
    // Validate event type
    if (!VALID_EVENT_TYPES.has(params.eventType)) {
      throw new Error(`Invalid event type: "${params.eventType}". Must be one of: ${[...VALID_EVENT_TYPES].join(', ')}`);
    }

    // Validate source type
    if (!VALID_SOURCE_TYPES.has(params.sourceType)) {
      throw new Error(`Invalid source type: "${params.sourceType}". Must be a valid source type.`);
    }

    // Validate source type matches event type category
    const allowedSources = EVENT_SOURCE_MAP[params.eventType];
    if (allowedSources && !allowedSources.includes(params.sourceType)) {
      // Allow fallback for common cases but warn
      console.warn(
        `[TimelineEngine] Event type "${params.eventType}" typically uses sources [${allowedSources.join(', ')}], got "${params.sourceType}". Allowing.`
      );
    }

    // CRITICAL RULE: Do not fabricate timestamps. Use actual event timestamp.
    // If timestamp is in the future, clamp to now.
    const eventTimestamp = this.validateTimestamp(params.timestamp);

    // Build evidence metadata from source info
    const evidence: EvidenceMetadata = {
      sourceType: params.sourceType,
      sourceId: params.sourceId || undefined,
      sourceText: params.description,
      speakerId: params.speaker || undefined,
      timestamp: eventTimestamp.toISOString(),
      confidence: params.confidence !== undefined ? params.confidence : 0.5,
      verificationStatus: 'UNVERIFIED',
    };

    const event = await prisma.timelineEvent.create({
      data: {
        incidentId: params.incidentId,
        eventType: params.eventType,
        description: params.description,
        source: evidence as any,
        relatedEntity: params.relatedEntity || null,
        confidence: params.confidence !== undefined ? params.confidence : 0.5,
        timestamp: eventTimestamp,
      },
    });

    // Convert to TimelineEvent with full fields
    const sourceData = (event.source as unknown as EvidenceMetadata) || {};
    const fullEvent: TimelineEvent = {
      id: event.id,
      incidentId: event.incidentId,
      eventType: event.eventType as TimelineEventType,
      description: event.description,
      sourceType: sourceData.sourceType || 'HUMAN_SPOKEN',
      sourceId: sourceData.sourceId || null,
      speaker: sourceData.speakerId || null,
      speakerRole: null,
      confidence: event.confidence ?? 0.5,
      relatedEntity: event.relatedEntity,
      timestamp: event.timestamp.toISOString(),
      createdAt: event.createdAt.toISOString(),
    };

    // Emit realtime event
    realtimeEventHub.emitToIncident(params.incidentId, 'timeline.updated', {
      incidentId: params.incidentId,
      timeline: [fullEvent as any],
    });

    return fullEvent;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Batch create timeline events (for backfilling historical data)
  // ───────────────────────────────────────────────────────────────────────

  async createEventsBatch(incidentId: string, events: CreateEventParams[]): Promise<TimelineEvent[]> {
    const results: TimelineEvent[] = [];
    for (const evt of events) {
      try {
        const created = await this.createEvent({ ...evt, incidentId });
        results.push(created);
      } catch (err) {
        console.error(`[TimelineEngine] Failed to create event "${evt.eventType}":`, err);
      }
    }
    return results;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Get incident timeline — single source of truth for dashboard
  // ───────────────────────────────────────────────────────────────────────

  async getIncidentTimeline(
    incidentId: string,
    filter: TimelineFilter = {}
  ): Promise<TimelinePage> {
    const {
      order = 'chronological',
      eventType,
      sourceType,
      limit = 100,
      offset = 0,
      fromTimestamp,
      toTimestamp,
    } = filter;

    // Build where clause
    // Note: sourceType is stored inside the `source` JSON field, not a top-level column
    // Filter eventType and timestamp on DB, sourceType client-side
    const where: Record<string, any> = { incidentId };
    if (eventType) where.eventType = eventType;
    if (fromTimestamp || toTimestamp) {
      where.timestamp = {};
      if (fromTimestamp) where.timestamp.gte = new Date(fromTimestamp);
      if (toTimestamp) where.timestamp.lte = new Date(toTimestamp);
    }

    // Fetch all matching events (with a generous limit for client-side sourceType filtering)
    const filterLimit = limit + (offset || 0) + 50;
    const events = await prisma.timelineEvent.findMany({
      where,
      orderBy: { timestamp: order === 'latest' ? 'desc' : 'asc' },
      take: filterLimit,
    });

    // Sort as safety net
    const sorted = events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Client-side sourceType filter
    const filtered = sourceType
      ? sorted.filter((e) => (e.source as any)?.sourceType === sourceType)
      : sorted;

    // Apply offset/limit after filtering
    const paged = filtered.slice(offset || 0, (offset || 0) + limit);

    // Check if there are more
    const total = sorted.length;
    const hasMore = (offset || 0) + paged.length < total;

    const summaries: TimelineEventSummary[] = paged.map((e) => this.toEventSummary(e));

    return {
      events: summaries,
      total,
      hasMore,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Get timeline by event type filter
  // ───────────────────────────────────────────────────────────────────────

  async getTimelineByType(incidentId: string, eventType: string): Promise<TimelineEventSummary[]> {
    const page = await this.getIncidentTimeline(incidentId, { eventType, order: 'chronological', limit: 500 });
    return page.events;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Get latest N events
  // ───────────────────────────────────────────────────────────────────────

  async getLatestEvents(incidentId: string, limit: number = 50): Promise<TimelineEventSummary[]> {
    const page = await this.getIncidentTimeline(incidentId, { order: 'latest', limit });
    return page.events;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Get events by time range
  // ───────────────────────────────────────────────────────────────────────

  async getTimelineByTimeRange(
    incidentId: string,
    from: Date,
    to: Date
  ): Promise<TimelineEventSummary[]> {
    const page = await this.getIncidentTimeline(incidentId, {
      order: 'chronological',
      fromTimestamp: from.toISOString(),
      toTimestamp: to.toISOString(),
      limit: 500,
    });
    return page.events;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Check if timeline is empty (for incident with no events yet)
  // ───────────────────────────────────────────────────────────────────────

  async hasEvents(incidentId: string): Promise<boolean> {
    const count = await prisma.timelineEvent.count({ where: { incidentId } });
    return count > 0;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Helper: Validate timestamp — never fabricate
  // ───────────────────────────────────────────────────────────────────────

  private validateTimestamp(timestamp: Date | string | undefined): Date {
    let dt: Date;
    if (timestamp instanceof Date) {
      dt = timestamp;
    } else if (typeof timestamp === 'string') {
      dt = new Date(timestamp);
    } else {
      dt = new Date();
    }

    const now = new Date();
    // If timestamp is in the future, clamp to now — NEVER fabricate timestamps
    if (dt > now) {
      console.warn(`[TimelineEngine] Timestamp ${dt.toISOString()} is in the future. Clamping to now.`);
      dt = now;
    }

    // If timestamp is invalid, use now
    if (isNaN(dt.getTime())) {
      console.warn(`[TimelineEngine] Invalid timestamp provided. Using now.`);
      dt = new Date();
    }

    return dt;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Helper: Convert Prisma TimelineEvent to TimelineEventSummary
  // ───────────────────────────────────────────────────────────────────────

  private toEventSummary(event: any): TimelineEventSummary {
    const source = (event.source as EvidenceMetadata) || {};
    return {
      id: event.id,
      eventType: event.eventType,
      description: event.description,
      eventTime: event.timestamp.toISOString(),
      evidence: {
        sourceType: source.sourceType || 'HUMAN_SPOKEN',
        sourceId: source.sourceId || undefined,
        sourceText: source.sourceText || event.description,
        speakerId: source.speakerId || undefined,
        timestamp: source.timestamp || event.timestamp.toISOString(),
        confidence: event.confidence || 0.5,
        verificationStatus: source.verificationStatus || 'UNVERIFIED',
      } as EvidenceMetadata,
      createdAt: event.createdAt.toISOString(),
      sourceType: source.sourceType || 'HUMAN_SPOKEN',
      sourceId: source.sourceId || null,
      speaker: source.speakerId || null,
      confidence: event.confidence || 0.5,
      relatedEntity: event.relatedEntity || null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateEventParams
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateEventParams {
  incidentId: string;
  eventType: string;
  description: string;
  sourceType: SourceType;
  sourceId?: string;
  speaker?: string | null;
  speakerRole?: string | null;
  confidence?: number;
  relatedEntity?: string | null;
  timestamp?: Date | string;
}

export const incidentTimelineEngine = new IncidentTimelineEngine();