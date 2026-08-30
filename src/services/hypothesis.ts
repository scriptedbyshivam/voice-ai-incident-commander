import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';
import { factService } from './fact';

export class HypothesisService {
  async createHypothesis(
    incidentId: string,
    title: string,
    description: string,
    evidence: EvidenceMetadata
  ) {
    const hypothesis = await prisma.hypothesis.create({
      data: {
        incidentId,
        title,
        description,
        status: 'UNCONFIRMED',
        evidence: evidence as any,
      },
    });

    // Record timeline event
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'HYPOTHESIS',
        description: `New Hypothesis Proposed: ${title}`,
        source: evidence as any,
        relatedEntity: `Hypothesis:${hypothesis.id}`,
        confidence: evidence.confidence,
      },
    });

    return hypothesis;
  }

  async verifyHypothesis(
    hypothesisId: string,
    verifierName: string,
    notes?: string
  ) {
    const hypothesis = await prisma.hypothesis.findUnique({
      where: { id: hypothesisId },
    });

    if (!hypothesis) {
      throw new Error('Hypothesis not found');
    }

    const currentEvidence = hypothesis.evidence as unknown as EvidenceMetadata;
    const updatedEvidence: EvidenceMetadata = {
      ...currentEvidence,
      verificationStatus: 'VERIFIED',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      sourceText: notes ? `${currentEvidence.sourceText || ''} | Verified by ${verifierName}: ${notes}` : currentEvidence.sourceText,
    };

    // 1. Update the Hypothesis record status to CONFIRMED
    const updatedHypothesis = await prisma.hypothesis.update({
      where: { id: hypothesisId },
      data: {
        status: 'CONFIRMED',
        evidence: updatedEvidence as any,
      },
    });

    // 2. Create the corresponding confirmed Fact (Hypotheses are promoted to facts upon verification)
    const promotedFact = await factService.createFact(
      hypothesis.incidentId,
      hypothesis.title,
      hypothesis.description,
      {
        sourceType: 'MANUAL_CONFIRMATION',
        sourceId: `Hypothesis:${hypothesis.id}`,
        sourceText: `Promoted from verified hypothesis: ${hypothesis.title}. Verification notes: ${notes || 'None'}`,
        speakerId: verifierName,
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
      'CONFIRMED'
    );

    // 3. Record verified timeline event
    await prisma.timelineEvent.create({
      data: {
        incidentId: hypothesis.incidentId,
        eventType: 'HYPOTHESIS_VERIFIED',
        description: `Hypothesis Verified & Promoted to Fact: ${hypothesis.title} by ${verifierName}`,
        source: updatedEvidence as any,
        relatedEntity: `Fact:${promotedFact.id}`,
        confidence: 1.0,
      },
    });

    return {
      hypothesis: updatedHypothesis,
      fact: promotedFact,
    };
  }

  async getHypotheses(incidentId: string) {
    return prisma.hypothesis.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const hypothesisService = new HypothesisService();
