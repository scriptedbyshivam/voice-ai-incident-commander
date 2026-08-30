import prisma from '@/lib/db';
import { aiProvider } from './ai';

export class ApprovalsService {
  async createRequest(
    incidentId: string,
    actionTitle: string,
    actionDetails: string,
    requestedBy: string,
    evidence?: any
  ) {
    // Automatically classify if the action requires approval
    const classification = await aiProvider.classifyCriticalAction(actionTitle, actionDetails);

    return prisma.approvalRequest.create({
      data: {
        incidentId,
        actionTitle,
        actionDetails,
        requestedBy,
        status: classification.isCritical ? 'PENDING' : 'APPROVED',
        evidence: evidence ? (evidence as any) : {},
      },
    });
  }

  async approveRequest(id: string, approvedBy: string) {
    return prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async rejectRequest(id: string, rejectedBy: string) {
    return prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
      },
    });
  }

  async getIncidentRequests(incidentId: string) {
    return prisma.approvalRequest.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const approvalsService = new ApprovalsService();
