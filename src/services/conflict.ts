import prisma from '@/lib/db';
import { EvidenceMetadata } from '@/types/incident';
import { aiSpeakerService } from './aiSpeaker';

export class ConflictService {
  async detectAndRecord(
    incidentId: string,
    topic: string,
    claimA: string,
    claimB: string,
    sourceA: EvidenceMetadata,
    sourceB: EvidenceMetadata
  ) {
    const conflict = await prisma.conflict.create({
      data: {
        incidentId,
        topic,
        claimA,
        claimB,
        sourceA: sourceA as any,
        sourceB: sourceB as any,
        status: 'UNRESOLVED',
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'CONFLICT',
        description: `Operational Conflict Detected: "${topic}" - Claim A: "${claimA}" vs Claim B: "${claimB}"`,
        source: sourceA as any, // Log source A as trigger
        relatedEntity: `Conflict:${conflict.id}`,
        confidence: Math.min(sourceA.confidence, sourceB.confidence),
      },
    });

    // AI spoken participation — major conflict detected is the #1 trigger.
    aiSpeakerService
      .evaluateAndSpeak(incidentId)
      .catch((err) => console.warn('[ConflictService] AI speak evaluation failed:', err.message));

    return conflict;
  }

  async resolveConflict(conflictId: string, verifierName: string, notes?: string) {
    const conflict = await prisma.conflict.findUnique({
      where: { id: conflictId },
    });

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    const updated = await prisma.conflict.update({
      where: { id: conflictId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId: conflict.incidentId,
        eventType: 'CONFLICT_RESOLVED',
        description: `Conflict "${conflict.topic}" resolved by ${verifierName}. Resolution notes: ${notes || 'None'}`,
        source: {
          sourceType: 'MANUAL_CONFIRMATION',
          speakerId: verifierName,
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'VERIFIED',
          sourceText: notes,
        } as any,
        relatedEntity: `Conflict:${conflictId}`,
        confidence: 1.0,
      },
    });

    return updated;
  }

  async getConflicts(incidentId: string) {
    return prisma.conflict.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const conflictService = new ConflictService();
