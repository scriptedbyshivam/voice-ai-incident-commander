import prisma from '@/lib/db';
import { ParticipantRole } from '@prisma/client';

export class ParticipantService {
  async addParticipant(incidentId: string, userId: string, role: ParticipantRole) {
    const participant = await prisma.participant.upsert({
      where: {
        incidentId_userId: { incidentId, userId },
      },
      update: {
        role,
        leftAt: null, // Reactivate if rejoined
      },
      create: {
        incidentId,
        userId,
        role,
      },
      include: {
        user: true,
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'PARTICIPANT_JOINED',
        description: `${participant.user.name} joined as ${role}`,
        source: {
          sourceType: 'MANUAL_CONFIRMATION',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'VERIFIED',
        } as any,
        relatedEntity: `Participant:${participant.id}`,
        confidence: 1.0,
      },
    });

    return participant;
  }

  async removeParticipant(incidentId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: {
        incidentId_userId: { incidentId, userId },
      },
      include: {
        user: true,
      },
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    const updated = await prisma.participant.update({
      where: {
        id: participant.id,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'PARTICIPANT_LEFT',
        description: `${participant.user.name} left the bridge`,
        source: {
          sourceType: 'MANUAL_CONFIRMATION',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'VERIFIED',
        } as any,
        relatedEntity: `Participant:${participant.id}`,
        confidence: 1.0,
      },
    });

    return updated;
  }

  async getParticipants(incidentId: string) {
    return prisma.participant.findMany({
      where: { incidentId },
      include: { user: true },
    });
  }
}

export const participantService = new ParticipantService();
