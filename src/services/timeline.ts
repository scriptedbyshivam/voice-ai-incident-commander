import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';

export class TimelineService {
  async addEvent(
    incidentId: string,
    eventType: string,
    description: string,
    source: EvidenceMetadata,
    relatedEntity?: string,
    confidence?: number,
    timestamp?: Date
  ) {
    return prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType,
        description,
        source: source as any,
        relatedEntity: relatedEntity || null,
        confidence: confidence !== undefined ? confidence : source.confidence,
        timestamp: timestamp || new Date(),
      },
    });
  }

  async getTimeline(incidentId: string) {
    // Sort timeline chronologically by timestamp
    const events = await prisma.timelineEvent.findMany({
      where: { incidentId },
      orderBy: { timestamp: 'asc' },
    });
    return events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
}

export const timelineService = new TimelineService();
