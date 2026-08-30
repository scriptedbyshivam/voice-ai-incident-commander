import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';

export class DecisionService {
  async recordDecision(
    incidentId: string,
    title: string,
    description: string,
    decidedBy: string,
    evidence: EvidenceMetadata
  ) {
    const decision = await prisma.decision.create({
      data: {
        incidentId,
        title,
        description,
        decidedBy,
        evidence: evidence as any,
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'DECISION',
        description: `Decision made by ${decidedBy}: ${title} - ${description}`,
        source: evidence as any,
        relatedEntity: `Decision:${decision.id}`,
        confidence: evidence.confidence,
      },
    });

    return decision;
  }

  async getDecisions(incidentId: string) {
    return prisma.decision.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const decisionService = new DecisionService();
