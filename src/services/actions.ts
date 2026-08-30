import prisma from '@/lib/db';
import { ActionStatus } from '@prisma/client';
import { EvidenceMetadata } from '@/types/incident';

export class ActionsService {
  async createAction(
    incidentId: string,
    title: string,
    description: string,
    evidence: EvidenceMetadata,
    assigneeId?: string,
    dueAt?: Date
  ) {
    const action = await prisma.actionItem.create({
      data: {
        incidentId,
        title,
        description,
        status: 'PENDING',
        evidence: evidence as any,
        assigneeId: assigneeId || null,
        dueAt: dueAt || null,
      },
    });

    // Create initial history entry
    await prisma.actionStatusHistory.create({
      data: {
        actionItemId: action.id,
        oldStatus: 'PENDING',
        newStatus: 'PENDING',
        changedBy: 'System',
        notes: 'Action item created.',
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId,
        eventType: 'ACTION_ITEM',
        description: `Action Created: ${title} (Pending)`,
        source: evidence as any,
        relatedEntity: `ActionItem:${action.id}`,
        confidence: evidence.confidence,
      },
    });

    return action;
  }

  async updateActionStatus(
    actionId: string,
    newStatus: ActionStatus,
    changedBy: string,
    notes?: string
  ) {
    const action = await prisma.actionItem.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      throw new Error('Action item not found');
    }

    const oldStatus = action.status;

    // Determine extra fields based on new status
    const updateData: any = { status: newStatus };
    if (newStatus === 'BLOCKED') {
      updateData.blockedReason = notes || 'No blocked reason provided.';
    } else if (newStatus === 'COMPLETED') {
      updateData.completionNotes = notes || 'Action item resolved.';
    }

    const updatedAction = await prisma.actionItem.update({
      where: { id: actionId },
      data: updateData,
    });

    // Create history entry
    await prisma.actionStatusHistory.create({
      data: {
        actionItemId: actionId,
        oldStatus,
        newStatus,
        changedBy,
        notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
      },
    });

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId: action.incidentId,
        eventType: 'ACTION_UPDATED',
        description: `Action status updated: "${action.title}" changed from ${oldStatus} to ${newStatus} by ${changedBy}`,
        source: action.evidence as any,
        relatedEntity: `ActionItem:${actionId}`,
        confidence: 1.0,
      },
    });

    return updatedAction;
  }

  async reassignAction(
    actionId: string,
    newAssigneeId: string | null,
    changedBy: string
  ) {
    const action = await prisma.actionItem.findUnique({
      where: { id: actionId },
      include: { assignee: true },
    });

    if (!action) {
      throw new Error('Action item not found');
    }

    const oldAssigneeName = action.assignee ? action.assignee.name : 'Unassigned';

    const updated = await prisma.actionItem.update({
      where: { id: actionId },
      data: { assigneeId: newAssigneeId },
      include: { assignee: true },
    });

    const newAssigneeName = updated.assignee ? updated.assignee.name : 'Unassigned';

    // Record on timeline
    await prisma.timelineEvent.create({
      data: {
        incidentId: action.incidentId,
        eventType: 'ACTION_REASSIGNED',
        description: `Action "${action.title}" reassigned: ${oldAssigneeName} → ${newAssigneeName} by ${changedBy}`,
        source: action.evidence as any,
        relatedEntity: `ActionItem:${actionId}`,
        confidence: 1.0,
      },
    });

    return updated;
  }

  async getActions(incidentId: string) {
    return prisma.actionItem.findMany({
      where: { incidentId },
      include: {
        assignee: true,
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const actionsService = new ActionsService();
