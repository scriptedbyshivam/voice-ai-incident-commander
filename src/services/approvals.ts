import prisma from '@/lib/db';
import { timelineService } from './timeline';
import { realtimeEventHub } from './eventHub';
import { aiSpeakerService } from './aiSpeaker';
import { executeApprovedAction } from './approvalExecution';
import { EvidenceMetadata } from '@/types/incident';

// ─────────────────────────────────────────────────────────────────────────────
// Human Approval Workflow Service
//
// SECURITY RULES (non-negotiable):
//   1. APPROVAL MUST BE EXPLICIT — a human must review and click Approve/Reject.
//      There are NO implicit approvals, ever.
//   2. NO AUTOMATIC EXECUTION AFTER TIMEOUT — an EXPIRED approval is simply a
//      dead PENDING. It never approves and never executes on its own.
//   3. NO APPROVAL BASED ONLY ON AI CONFIDENCE — AI may request approval, but
//      only a human decision can grant it.
//   4. Execution runs ONLY after a human APPROVED a PENDING request, and it
//      always targets the SAFE MOCK endpoint (never a real production env).
// ─────────────────────────────────────────────────────────────────────────────

export type ApprovalStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

const APPROVAL_STATUSES: ApprovalStatusValue[] = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'];

export class ApprovalsService {
  /**
   * Create an approval request for a critical action. This NEVER executes the
   * action — it only surfaces it for a human decision.
   *
   * NOTE: The old behavior auto-approved non-critical actions. That is removed:
   * every request starts PENDING and waits for explicit human review. If the
   * caller passes a known actionId the linked ActionItem is marked as requiring
   * approval.
   */
  async createRequest(
    incidentId: string,
    actionTitle: string,
    actionDetails: string,
    requestedBy: string,
    evidence?: any,
    opts?: { actionId?: string; expiresAt?: Date | null; reason?: string }
  ) {
    const approval = await prisma.approvalRequest.create({
      data: {
        incidentId,
        actionId: opts?.actionId || null,
        actionTitle,
        actionDetails,
        requestedBy,
        // ALWAYS pending — approval is never implicit.
        status: 'PENDING',
        expiresAt: opts?.expiresAt ?? null,
        evidence: evidence ? (evidence as any) : {},
      },
    });

    // Link the underlying action and mark it as requiring approval so the
    // state machine will not let it advance without authorization.
    if (opts?.actionId) {
      await prisma.actionItem.update({
        where: { id: opts.actionId },
        data: { requiresApproval: true, approvalId: approval.id },
      });
    }

    // Audit trail — an approval request was created.
    const ev: EvidenceMetadata = evidence || {
      sourceType: 'HUMAN_SPOKEN',
      sourceText: actionDetails,
      timestamp: new Date().toISOString(),
      confidence: 1.0,
      verificationStatus: 'UNVERIFIED',
    };
    await timelineService.addEvent(
      incidentId,
      'APPROVAL_REQUESTED',
      `Critical action requires human approval: "${actionTitle}"${opts?.reason ? ` — ${opts.reason}` : ''}`,
      ev,
      opts?.actionId ? `ActionItem:${opts.actionId}` : undefined,
      1.0,
      new Date()
    );

    // Realtime — dashboards/voice rooms show the approval prompt.
    realtimeEventHub.emitToIncident(incidentId, 'approval.required', {
      approval: this.toPayload(approval),
    });

    // AI speaks the approval prompt out loud.
    aiSpeakerService
      .notifyCriticalAction(incidentId, actionTitle, actionDetails)
      .catch((err) => console.warn('[Approvals] AI speech failed:', (err as Error).message));

    return approval;
  }

  /**
   * Approve a PENDING approval request — triggers (mock) execution of the
   * linked critical action. An explicit human `approvedBy` AND (for dangerous
   * actions) matching `confirmationText` is required.
   */
  async approveRequest(id: string, approvedBy: string, confirmationText?: string) {
    const approval = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!approval) throw new Error('Approval request not found');

    if (approval.status === 'APPROVED') {
      return approval;
    }
    if (approval.status !== 'PENDING') {
      throw new Error(`Approval request is ${approval.status.toLowerCase()}; only PENDING requests can be approved.`);
    }
    // No implicit/auto approval — an explicit reviewer is mandatory.
    if (!approvedBy || !approvedBy.trim()) {
      throw new Error('A named human reviewer is required to approve a critical action.');
    }
    // Stale approvals (past their expiry) cannot be approved.
    if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) {
      await this.markExpired(approval.id);
      throw new Error('This approval request has expired and can no longer be approved.');
    }
    // Dangerous actions require the reviewer to type confirmation.
    if (isDangerousAction(approval.actionTitle, approval.actionDetails) && confirmationText?.trim() !== 'CONFIRM') {
      throw new Error('Type CONFIRM to approve this dangerous production action.');
    }

    const now = new Date();
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy, approvedAt: now },
    });

    // Audit trail — approval granted.
    const ev: EvidenceMetadata = {
      sourceType: 'MANUAL_CONFIRMATION',
      sourceText: `Approved by ${approvedBy}`,
      timestamp: now.toISOString(),
      confidence: 1.0,
      verificationStatus: 'VERIFIED',
    };
    await timelineService.addEvent(
      approval.incidentId,
      'APPROVAL_GRANTED',
      `Critical action APPROVED by ${approvedBy}: "${approval.actionTitle}"`,
      ev,
      approval.actionId ? `ActionItem:${approval.actionId}` : undefined,
      1.0,
      now
    );

    // Execute ONLY now that a human has approved. Targets the safe mock handler.
    const execution = await executeApprovedAction(
      approval.incidentId,
      approval.actionId,
      approval.actionTitle,
      approval.actionDetails,
      approvedBy
    );

    realtimeEventHub.emitToIncident(approval.incidentId, 'approval.completed', {
      approval: this.toPayload(updated),
    });

    return { ...updated, execution };
  }

  /**
   * Reject a PENDING approval request. Rejection NEVER executes the action and
   * marks the linked action as CANCELLED/blocked so it cannot proceed.
   */
  async rejectRequest(id: string, rejectedBy: string, reason?: string) {
    const approval = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!approval) throw new Error('Approval request not found');

    if (approval.status === 'REJECTED') {
      return approval;
    }
    if (approval.status !== 'PENDING') {
      throw new Error(`Approval request is ${approval.status.toLowerCase()}; only PENDING requests can be rejected.`);
    }
    if (!rejectedBy || !rejectedBy.trim()) {
      throw new Error('A named human reviewer is required to reject a critical action.');
    }

    const now = new Date();
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectedBy, rejectedAt: now },
    });

    // Mark the linked action as CANCELLED so it cannot proceed without being
    // reapplied and re-approved.
    if (approval.actionId) {
      await prisma.actionItem
        .update({
          where: { id: approval.actionId },
          data: { status: 'CANCELLED', blockedReason: reason || 'Rejected by human reviewer.' },
        })
        .catch(() => {});
    }

    // Audit trail — approval rejected.
    const ev: EvidenceMetadata = {
      sourceType: 'MANUAL_CONFIRMATION',
      sourceText: `Rejected by ${rejectedBy}${reason ? ` — ${reason}` : ''}`,
      timestamp: now.toISOString(),
      confidence: 1.0,
      verificationStatus: 'VERIFIED',
    };
    await timelineService.addEvent(
      approval.incidentId,
      'APPROVAL_REJECTED',
      `Critical action REJECTED by ${rejectedBy}: "${approval.actionTitle}"${reason ? ` (${reason})` : ''}`,
      ev,
      approval.actionId ? `ActionItem:${approval.actionId}` : undefined,
      1.0,
      now
    );

    realtimeEventHub.emitToIncident(approval.incidentId, 'approval.completed', {
      approval: this.toPayload(updated),
    });

    return updated;
  }

  /**
   * Mark PENDING requests that have passed their expiry as EXPIRED. Never
   * auto-approves and never executes — EXPIRED is a terminal, inert state.
   */
  async expirePendingApprovals(incidentId?: string): Promise<number> {
    const where = {
      status: 'PENDING' as const,
      expiresAt: { not: null as any, lt: new Date() },
      ...(incidentId ? { incidentId } : {}),
    };
    const expired = await prisma.approvalRequest.findMany({ where });
    let count = 0;
    for (const req of expired) {
      const updated = await this.markExpired(req.id);
      if (updated) count++;
      realtimeEventHub.emitToIncident(req.incidentId, 'approval.completed', {
        approval: this.toPayload(updated),
      });
    }
    return count;
  }

  async getIncidentRequests(incidentId: string) {
    return prisma.approvalRequest.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(id: string) {
    return prisma.approvalRequest.findUnique({ where: { id } });
  }

  private async markExpired(id: string) {
    return prisma.approvalRequest.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
  }

  private toPayload(approval: any) {
    return {
      id: approval.id,
      incidentId: approval.incidentId,
      actionId: approval.actionId,
      actionTitle: approval.actionTitle,
      actionDetails: approval.actionDetails,
      requestedBy: approval.requestedBy,
      status: approval.status as ApprovalStatusValue,
      approvedBy: approval.approvedBy,
      rejectedBy: approval.rejectedBy,
      approvedAt: approval.approvedAt ? approval.approvedAt.toISOString() : null,
      rejectedAt: approval.rejectedAt ? approval.rejectedAt.toISOString() : null,
      expiresAt: approval.expiresAt ? approval.expiresAt.toISOString() : null,
    };
  }
}

/** Dangerous = rollback, restart, disable, drop, terminate, failover, delete, shutdown, scale. */
function isDangerousAction(title: string, details: string): boolean {
  const text = `${title} ${details}`.toLowerCase();
  return [
    'rollback', 'restart', 'reboot', 'disable', 'drop', 'terminate',
    'failover', 'delete', 'shut down', 'scale', 'redeploy',
  ].some((w) => text.includes(w));
}

export const approvalsService = new ApprovalsService();
/** Re-export so the schema parser can reference it (e.g. in API routes). */
export { APPROVAL_STATUSES };
export default approvalsService;