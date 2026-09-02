import prisma from '@/lib/db';
import { timelineService } from './timeline';
import { realtimeEventHub } from './eventHub';
import { EvidenceMetadata } from '@/types/incident';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Execution Handler
//
// SAFETY: This is a HACKATHON demo. It NEVER touches a real production
// environment — it only simulates the effect of a critical operational action
// in-memory and records a timeline event. The only thing executed here is a
// deterministic mock response string.
//
// SECURITY: This runs ONLY after an explicit human APPROVAL. There is no path
// where the AI (or any automated process) triggers execution on its own.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  actionType: string;
  output: string;
  executedAt: string;
  mock: true;
}

export type CriticalActionKind =
  | 'rollback'
  | 'restart'
  | 'disable'
  | 'config'
  | 'scale'
  | 'failover'
  | 'generic';

/**
 * Classify a critical action title/details into one of the known kinds. This
 * mapping drives the realistic mock output below.
 */
export function classifyActionKind(title: string, details: string): CriticalActionKind {
  const text = `${title} ${details}`.toLowerCase();
  if (text.includes('rollback') || text.includes('roll back')) return 'rollback';
  if (text.includes('failover')) return 'failover';
  if (text.includes('restart') || text.includes('reboot')) return 'restart';
  if (text.includes('disable') || text.includes('disable feature') || text.includes('feature flag')) return 'disable';
  if (text.includes('scale')) return 'scale';
  if (text.includes('config') || text.includes('configuration') || text.includes('timeout')) return 'config';
  return 'generic';
}

/**
 * Produce the realistic mock output for a given action kind. Deterministic per
 * kind so tests can assert on the exact string.
 */
export function mockExecutionOutput(kind: CriticalActionKind, title: string): string {
  const target = title.trim().replace(/:$/, '');
  switch (kind) {
    case 'rollback':
      return `[MOCK] Deployment rolled back for "${target}". Previous version restored and traffic reverted. No production impact occurred (sandbox).`;
    case 'restart':
      return `[MOCK] Service "${target}" restarted. New instances healthy, connection pool drained. (sandbox)`;
    case 'disable':
      return `[MOCK] Feature "${target}" disabled via flag. Requests now bypass the feature. (sandbox)`;
    case 'config':
      return `[MOCK] Production configuration changed for "${target}". Change recorded and diff logged. (sandbox)`;
    case 'scale':
      return `[MOCK] Infrastructure scaled for "${target}". Replica count increased and autoscaler updated. (sandbox)`;
    case 'failover':
      return `[MOCK] Database failover triggered for "${target}". Replica promoted to primary; replication healthy. (sandbox)`;
    default:
      return `[MOCK] Executed approved critical action "${target}". No production impact (sandbox).`;
  }
}

/**
 * Execute an approved action. Called ONLY from the approval service after a
 * human approves a PENDING request. Records the execution on the timeline and
 * emits a realtime event.
 */
export async function executeApprovedAction(
  incidentId: string,
  actionId: string | null,
  actionTitle: string,
  actionDetails: string,
  approvedBy: string
): Promise<ExecutionResult> {
  const kind = classifyActionKind(actionTitle, actionDetails);
  const output = mockExecutionOutput(kind, actionTitle);
  const executedAt = new Date().toISOString();

  // Mark the underlying action as IN_PROGRESS now that it is human-approved.
  if (actionId) {
    await prisma.actionItem
      .update({
        where: { id: actionId },
        data: { status: 'IN_PROGRESS', requiresApproval: true },
      })
      .catch(() => {});

    await prisma.actionStatusHistory
      .create({
        data: {
          actionItemId: actionId,
          oldStatus: 'PENDING',
          newStatus: 'IN_PROGRESS',
          changedBy: approvedBy,
          notes: `Action approved and execution initiated. ${output}`,
        },
      })
      .catch(() => {});
  }

  const evidence: EvidenceMetadata = {
    sourceType: 'MANUAL_CONFIRMATION',
    sourceText: output,
    timestamp: executedAt,
    confidence: 1.0,
    verificationStatus: 'VERIFIED',
  };

  // Audit trail — the fact of execution is a timeline event.
  await timelineService.addEvent(
    incidentId,
    'ACTION_UPDATED',
    `Approved critical action executed (mock, sandbox): "${actionTitle}". Handler output: ${output}`,
    evidence,
    actionId ? `ActionItem:${actionId}` : undefined,
    1.0,
    new Date()
  );

  realtimeEventHub.emitToIncident(incidentId, 'incident.updated', {
    incidentId,
    state: {} as any,
  });

  return { success: true, actionType: kind, output, executedAt, mock: true };
}

export const approvalExecutionService = { executeApprovedAction, classifyActionKind, mockExecutionOutput };
export default approvalExecutionService;