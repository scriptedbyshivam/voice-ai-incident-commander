import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';
import { EvidenceStatus } from '@prisma/client';

export class FactService {
  async createFact(
    incidentId: string,
    title: string,
    description: string,
    evidence: EvidenceMetadata,
    status: EvidenceStatus = 'REPORTED'
  ) {
    // If status is CONFIRMED, make sure it has verification metadata
    let finalStatus = status;
    if (status === 'CONFIRMED' && (!evidence.verificationStatus || evidence.verificationStatus === 'UNVERIFIED')) {
      finalStatus = 'REPORTED'; // Enforce verification constraint: facts cannot be silently created as confirmed without verification
    }

    const fact = await prisma.fact.create({
      data: {
        incidentId,
        title,
        description,
        status: finalStatus,
        evidence: evidence as any,
      },
    });

    // Automatically log a timeline event for this fact
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'FACT',
        description: `New Fact Logged: ${title} (${finalStatus})`,
        source: evidence as any,
        relatedEntity: `Fact:${fact.id}`,
        confidence: evidence.confidence,
      },
    });

    return fact;
  }

  async verifyFact(
    factId: string,
    verifierName: string,
    notes?: string
  ) {
    const existingFact = await prisma.fact.findUnique({
      where: { id: factId },
    });

    if (!existingFact) {
      throw new Error('Fact not found');
    }

    const currentEvidence = existingFact.evidence as unknown as EvidenceMetadata;
    const updatedEvidence: EvidenceMetadata = {
      ...currentEvidence,
      verificationStatus: 'VERIFIED',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      sourceText: notes ? `${currentEvidence.sourceText || ''} | Verified by ${verifierName}: ${notes}` : currentEvidence.sourceText,
    };

    const updatedFact = await prisma.fact.update({
      where: { id: factId },
      data: {
        status: 'CONFIRMED',
        evidence: updatedEvidence as any,
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId: existingFact.incidentId,
        eventType: 'FACT_VERIFIED',
        description: `Fact Verified by ${verifierName}: ${existingFact.title}`,
        source: updatedEvidence as any,
        relatedEntity: `Fact:${factId}`,
        confidence: 1.0,
      },
    });

    return updatedFact;
  }

  async getFacts(incidentId: string) {
    return prisma.fact.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const factService = new FactService();
