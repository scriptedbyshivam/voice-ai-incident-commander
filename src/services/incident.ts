import prisma from '@/lib/db';
import {
  IncidentState,
  IncidentStatus,
  Severity,
  ParticipantSummary,
  ParticipantRole,
  FactSummary,
  HypothesisSummary,
  DecisionSummary,
  ActionItemSummary,
  ConflictSummary,
  OpenQuestionSummary,
  TimelineEventSummary,
  EvidenceMetadata,
} from '@/types/incident';
import { aiProvider } from './ai';
import { incidentStateAggregationService } from './aggregation';

export class IncidentService {
  async createIncident(
    title: string,
    severity: Severity,
    description?: string,
    commander?: { name: string; email: string },
    initialParticipants?: Array<{ name: string; role: ParticipantRole; email?: string }>
  ) {
    const incident = await prisma.incident.create({
      data: {
        title,
        severity,
        description: description || '',
        status: 'ACTIVE',
      },
    });

    // 1. Add Commander as Participant if provided
    if (commander) {
      const user = await prisma.user.upsert({
        where: { email: commander.email },
        update: { name: commander.name, role: 'INCIDENT_COMMANDER' },
        create: { email: commander.email, name: commander.name, role: 'INCIDENT_COMMANDER' },
      });

      await prisma.participant.create({
        data: {
          incidentId: incident.id,
          userId: user.id,
          role: 'INCIDENT_COMMANDER',
        },
      });

      // Log to timeline
      await prisma.timelineEvent.create({
        data: {
          incidentId: incident.id,
          eventType: 'PARTICIPANT_JOINED',
          description: `${user.name} joined the bridge as INCIDENT_COMMANDER (declared by command)`,
          source: {
            sourceType: 'MANUAL_CONFIRMATION',
            timestamp: new Date().toISOString(),
            confidence: 1.0,
            verificationStatus: 'VERIFIED',
          } as any,
          confidence: 1.0,
        },
      });
    }

    // 2. Add Initial Participants if provided
    if (initialParticipants && initialParticipants.length > 0) {
      for (const p of initialParticipants) {
        const email = p.email || `${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`;
        
        const user = await prisma.user.upsert({
          where: { email },
          update: { name: p.name },
          create: { email, name: p.name, role: p.role },
        });

        // Avoid adding the commander twice if they were listed in both
        const existingPart = await prisma.participant.findUnique({
          where: {
            incidentId_userId: {
              incidentId: incident.id,
              userId: user.id,
            },
          },
        });

        if (!existingPart) {
          await prisma.participant.create({
            data: {
              incidentId: incident.id,
              userId: user.id,
              role: p.role,
            },
          });

          await prisma.timelineEvent.create({
            data: {
              incidentId: incident.id,
              eventType: 'PARTICIPANT_JOINED',
              description: `${user.name} joined the bridge as ${p.role}`,
              source: {
                sourceType: 'MANUAL_CONFIRMATION',
                timestamp: new Date().toISOString(),
                confidence: 1.0,
                verificationStatus: 'VERIFIED',
              } as any,
              confidence: 1.0,
            },
          });
        }
      }
    }

    // 3. Log incident declaration timeline event
    await prisma.timelineEvent.create({
      data: {
        incidentId: incident.id,
        eventType: 'INCIDENT_CREATED',
        description: `Incident declared: "${title}" [${severity}]`,
        source: {
          sourceType: 'MANUAL_CONFIRMATION',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'VERIFIED',
        } as any,
        confidence: 1.0,
      },
    });

    return incident;
  }

  async listIncidents() {
    return prisma.incident.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateIncident(id: string, data: { status?: IncidentStatus; severity?: Severity; title?: string; description?: string }) {
    return prisma.incident.update({
      where: { id },
      data,
    });
  }

  async getIncident(id: string): Promise<IncidentState | null> {
    return incidentStateAggregationService.getIncidentState(id);
  }

  async getParticipants(incidentId: string) {
    return prisma.participant.findMany({
      where: { incidentId },
      include: { user: true },
    });
  }

  async addParticipant(incidentId: string, userId: string, role: ParticipantRole) {
    return prisma.participant.upsert({
      where: {
        incidentId_userId: { incidentId, userId },
      },
      update: { role },
      create: { incidentId, userId, role },
    });
  }

  async getTranscripts(incidentId: string) {
    return prisma.transcript.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addTranscript(incidentId: string, text: string, speakerName: string, participantId?: string) {
    return prisma.transcript.create({
      data: {
        incidentId,
        text,
        speakerName,
        participantId: participantId || null,
      },
    });
  }

  async generateSummary(incidentId: string) {
    const state = await this.getIncident(incidentId);
    if (!state) throw new Error('Incident not found');

    const stateText = JSON.stringify(state, null, 2);
    const summaryData = await aiProvider.generateIncidentSummary(stateText);

    return prisma.incidentSummary.create({
      data: {
        incidentId,
        summaryText: summaryData.summaryText,
        createdBy: 'AI Incident Commander',
      },
    });
  }
}

export const incidentService = new IncidentService();
