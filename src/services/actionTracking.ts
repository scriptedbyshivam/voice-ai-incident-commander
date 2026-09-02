import prisma from '@/lib/db';
import { ActionStatus } from '@prisma/client';
import { EvidenceMetadata } from '@/types/incident';
import { timelineService } from './timeline';
import { realtimeEventHub } from './eventHub';

// ─────────────────────────────────────────────────────────────────────────────
// Action Lifecycle State Machine
//
// Valid transitions:
//   PENDING    → IN_PROGRESS, BLOCKED, CANCELLED
//   IN_PROGRESS → COMPLETED, BLOCKED, CANCELLED
//   BLOCKED    → IN_PROGRESS, CANCELLED
//   COMPLETED  → (terminal)
//   CANCELLED  → (terminal)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  PENDING:     ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'BLOCKED', 'CANCELLED'],
  BLOCKED:     ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Staleness thresholds (in minutes)
// ─────────────────────────────────────────────────────────────────────────────

const STALE_THRESHOLDS: Record<ActionStatus, number> = {
  PENDING: 15,      // Pending > 15 min = stale
  IN_PROGRESS: 30,  // In progress > 30 min = stale
  BLOCKED: 0,       // Blocked is already flagged
  COMPLETED: 0,
  CANCELLED: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionBoard {
  incidentId: string;
  generatedAt: string;
  columns: ActionColumn[];
  stats: ActionStats;
}

export interface ActionColumn {
  status: ActionStatus;
  label: string;
  actions: ActionBoardItem[];
}

export interface ActionBoardItem {
  id: string;
  title: string;
  description: string;
  status: ActionStatus;
  owner: string;
  age: string;
  ageMinutes: number;
  dependencies: string[];
  blockers: string[];
  lastUpdate: string;
  isStale: boolean;
  reminderCount: number;
}

export interface ActionStats {
  total: number;
  pending: number;
  inProgress: number;
  blocked: number;
  completed: number;
  cancelled: number;
  stale: number;
  unassigned: number;
}

export interface ActionReminder {
  actionId: string;
  title: string;
  owner: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Actions Service
// ─────────────────────────────────────────────────────────────────────────────

export class ActionTrackingService {
  // ─────────────────────────────────────────────────────────────────────────
  // State machine: validate and execute transition
  // ─────────────────────────────────────────────────────────────────────────

  async transitionAction(
    actionId: string,
    newStatus: ActionStatus,
    changedBy: string,
    notes?: string
  ): Promise<{ success: boolean; action: any; error?: string }> {
    const action = await prisma.actionItem.findUnique({
      where: { id: actionId },
      include: { assignee: true, approval: true },
    });

    if (!action) {
      return { success: false, action: null, error: 'Action not found' };
    }

    const oldStatus = action.status;
    const allowed = VALID_TRANSITIONS[oldStatus];

    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        action,
        error: `Invalid transition: ${oldStatus} → ${newStatus}. Allowed: ${allowed.join(', ') || '(terminal)'}`,
      };
    }

    // ── HUMAN APPROVAL GATE ────────────────────────────────────────────────
    // A critical action that requires approval cannot be started (IN_PROGRESS)
    // or completed until a human has explicitly APPROVED it. `COMPLETED` is
    // also blocked unless there is a granted approval. CANCELLED is always
    // allowed — a human can always walk back a dangerous action.
    const approval = action.approval;
    const requiresApproval = action.requiresApproval === true;
    if (requiresApproval && newStatus !== 'CANCELLED') {
      const approvalState =
        approval?.status === 'APPROVED'
          ? 'APPROVED'
          : approval?.status === 'REJECTED'
            ? 'REJECTED'
            : approval?.status === 'EXPIRED'
              ? 'EXPIRED'
              : 'PENDING';
      if (approvalState !== 'APPROVED') {
        return {
          success: false,
          action,
          error: `This action requires human approval before it can proceed. Current approval status: ${approvalState}. Approve the request first.`,
        };
      }
    }
    // ── END APPROVAL GATE ─────────────────────────────────────────────────

    // Build update data
    const updateData: any = { status: newStatus };
    if (newStatus === 'BLOCKED') {
      updateData.blockedReason = notes || 'No blocked reason provided.';
    } else if (newStatus === 'COMPLETED') {
      updateData.completionNotes = notes || 'Action completed.';
    }

    const updatedAction = await prisma.actionItem.update({
      where: { id: actionId },
      data: updateData,
      include: { assignee: true },
    });

    // Record history
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
    await timelineService.addEvent(
      action.incidentId,
      `ACTION_${newStatus}`,
      `Action "${action.title}" changed from ${oldStatus} to ${newStatus} by ${changedBy}`,
      action.evidence as unknown as EvidenceMetadata,
      `ActionItem:${actionId}`,
      1.0,
      new Date()
    );

    // Emit realtime event
    realtimeEventHub.emitToIncident(action.incidentId, 'incident.updated', {
      incidentId: action.incidentId,
      state: {} as any,
    });

    return { success: true, action: updatedAction };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Create action with dependencies
  // ─────────────────────────────────────────────────────────────────────────

  async createActionWithDependencies(
    incidentId: string,
    title: string,
    description: string,
    evidence: EvidenceMetadata,
    assigneeId?: string,
    dependsOn?: string[],
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
        dependencies: dependsOn && dependsOn.length > 0 ? JSON.stringify(dependsOn) : undefined,
      },
    });

    // Create initial history
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
    await timelineService.addEvent(
      incidentId,
      'ACTION_ITEM',
      `Action Created: ${title} (Pending)`,
      evidence,
      `ActionItem:${action.id}`,
      evidence.confidence
    );

    // Emit event
    realtimeEventHub.emitToIncident(incidentId, 'incident.updated', {
      incidentId,
      state: {} as any,
    });

    return action;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Follow-up Engine: detect stale actions
  // ─────────────────────────────────────────────────────────────────────────

  async detectStaleActions(incidentId: string): Promise<ActionReminder[]> {
    const actions = await prisma.actionItem.findMany({
      where: {
        incidentId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: { assignee: true },
    });

    const now = new Date();
    const reminders: ActionReminder[] = [];

    for (const action of actions) {
      const threshold = STALE_THRESHOLDS[action.status];
      if (threshold === 0) continue;

      const ageMs = now.getTime() - action.createdAt.getTime();
      const ageMinutes = ageMs / (1000 * 60);

      if (ageMinutes > threshold) {
        // Mark as stale if not already
        if (!action.staleAt) {
          await prisma.actionItem.update({
            where: { id: action.id },
            data: { staleAt: now },
          });
        }

        const ownerName = action.assignee?.name || 'Unassigned';
        const severity: ActionReminder['severity'] =
          ageMinutes > threshold * 2 ? 'CRITICAL' :
          ageMinutes > threshold * 1.5 ? 'WARNING' : 'INFO';

        const message = this.buildReminderMessage(action.title, ownerName, action.status, Math.round(ageMinutes));

        reminders.push({
          actionId: action.id,
          title: action.title,
          owner: ownerName,
          message,
          severity,
        });
      }
    }

    return reminders;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Follow-up Engine: check dependency blockers
  // ─────────────────────────────────────────────────────────────────────────

  async detectDependencyBlockers(incidentId: string): Promise<ActionReminder[]> {
    const actions = await prisma.actionItem.findMany({
      where: {
        incidentId,
        status: 'PENDING',
      },
      include: { assignee: true },
    });

    const reminders: ActionReminder[] = [];

    for (const action of actions) {
      if (!action.dependencies) continue;
      const depIds: string[] = JSON.parse(action.dependencies as string);

      for (const depId of depIds) {
        const dep = await prisma.actionItem.findUnique({ where: { id: depId } });
        if (dep && dep.status !== 'COMPLETED' && dep.status !== 'CANCELLED') {
          const ownerName = action.assignee?.name || 'Unassigned';
          reminders.push({
            actionId: action.id,
            title: action.title,
            owner: ownerName,
            message: `Blocked by incomplete dependency: "${dep.title}" (${dep.status})`,
            severity: 'WARNING',
          });
        }
      }
    }

    return reminders;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Action Board: Kanban-style view
  // ─────────────────────────────────────────────────────────────────────────

  async getActionBoard(incidentId: string): Promise<ActionBoard> {
    const actions = await prisma.actionItem.findMany({
      where: { incidentId },
      include: {
        assignee: true,
        history: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    const boardItems: ActionBoardItem[] = actions.map((a) => {
      const ageMs = now.getTime() - a.createdAt.getTime();
      const ageMinutes = ageMs / (1000 * 60);
      const deps: string[] = a.dependencies ? JSON.parse(a.dependencies as string) : [];

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status,
        owner: a.assignee?.name || 'UNASSIGNED',
        age: this.formatAge(ageMinutes),
        ageMinutes: Math.round(ageMinutes),
        dependencies: deps,
        blockers: a.status === 'BLOCKED' ? [a.blockedReason || 'Unknown'] : [],
        lastUpdate: a.history[0]?.createdAt?.toISOString() || a.updatedAt.toISOString(),
        isStale: !!a.staleAt,
        reminderCount: a.reminderCount,
      };
    });

    const stats: ActionStats = {
      total: actions.length,
      pending: actions.filter((a) => a.status === 'PENDING').length,
      inProgress: actions.filter((a) => a.status === 'IN_PROGRESS').length,
      blocked: actions.filter((a) => a.status === 'BLOCKED').length,
      completed: actions.filter((a) => a.status === 'COMPLETED').length,
      cancelled: actions.filter((a) => a.status === 'CANCELLED').length,
      stale: actions.filter((a) => !!a.staleAt).length,
      unassigned: actions.filter((a) => !a.assigneeId).length,
    };

    const columns: ActionColumn[] = [
      { status: 'PENDING', label: 'Pending', actions: boardItems.filter((a) => a.status === 'PENDING') },
      { status: 'IN_PROGRESS', label: 'In Progress', actions: boardItems.filter((a) => a.status === 'IN_PROGRESS') },
      { status: 'BLOCKED', label: 'Blocked', actions: boardItems.filter((a) => a.status === 'BLOCKED') },
      { status: 'COMPLETED', label: 'Completed', actions: boardItems.filter((a) => a.status === 'COMPLETED') },
    ];

    return {
      incidentId,
      generatedAt: now.toISOString(),
      columns,
      stats,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildReminderMessage(title: string, owner: string, status: ActionStatus, ageMinutes: number): string {
    if (status === 'PENDING') {
      return `${owner}'s action "${title}" has been pending for ${ageMinutes} minutes.`;
    }
    if (status === 'IN_PROGRESS') {
      return `${owner}'s action "${title}" has been in progress for ${ageMinutes} minutes.`;
    }
    return `Action "${title}" needs attention.`;
  }

  private formatAge(minutes: number): string {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  }
}

export const actionTrackingService = new ActionTrackingService();
