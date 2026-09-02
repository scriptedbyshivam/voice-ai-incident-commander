#!/usr/bin/env npx ts-node
// ─────────────────────────────────────────────────────────────────────────────
// HUMAN APPROVAL WORKFLOW — Automated Test
//
// Tests:
// 1. AI proposes rollback → PENDING, no execution
// 2. Attempt to start action without approval → blocked by gate
// 3. Reject → no execution, action CANCELLED
// 4. Approve dangerous action without CONFIRM → rejected
// 5. Approve with CONFIRM → APPROVED, execution (mock), action IN_PROGRESS
// 6. Expire → EXPIRED, cannot approve later
//
// SECURITY RULES VERIFIED:
//   - No implicit approval (everything starts PENDING)
//   - No auto-execution after timeout (EXPIRED is inert)
//   - Only explicit human click + typed CONFIRM triggers execution
// ─────────────────────────────────────────────────────────────────────────────

import { approvalsService } from '../src/services/approvals';
import { actionTrackingService } from '../src/services/actionTracking';
import prisma from '../src/lib/db';

let PASS = 0;
let FAIL = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { console.log(`  PASS: ${msg}`); PASS++; }
  else { console.log(`  FAIL: ${msg}`); FAIL++; }
}

function assertIncludes(str: string, substr: string, msg: string) {
  assert(str.toLowerCase().includes(substr.toLowerCase()), msg);
}

// ─── Evidence factory ─────────────────────────────────────────────────────────

const mockEvidence = {
  sourceType: 'HUMAN_SPOKEN' as const,
  speakerId: 'AI-Commander',
  sourceText: 'Automated test evidence for approval workflow.',
  timestamp: new Date().toISOString(),
  confidence: 1.0,
  verificationStatus: 'UNVERIFIED' as const,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  HUMAN APPROVAL WORKFLOW — Test                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ─── Setup ──────────────────────────────────────────────────────────────
  const incident = await prisma.incident.create({
    data: {
      title: 'Approval Workflow Test Incident',
      description: 'Automated test: verifies human approval, rejection, expiry, execution gate.',
      status: 'ACTIVE',
      severity: 'SEV1',
    },
  });
  console.log(`\n  Created test incident: ${incident.id}`);

  const rahul = await prisma.user.findFirst({ where: { name: 'Rahul' } });
  assert(rahul !== null, 'Rahul user exists for assignee');

  // ─── STEP 1: AI proposes rollback → PENDING, no execution ────────────────
  console.log('\n━━━ STEP 1: AI proposes rollback ━━━');
  const action1 = await actionTrackingService.createActionWithDependencies(
    incident.id,
    'Rollback deployment v2.4.1 to v2.4.0',
    'Checkout payment failure rate exceeded 40% immediately after canary deployment of v2.4.1.',
    mockEvidence,
    rahul?.id
  );
  assert(action1.status === 'PENDING', `Action created with status PENDING (got: ${action1.status})`);

  const approval1 = await approvalsService.createRequest(
    incident.id,
    action1.title,
    'Deploy rollback for payment-routing canary cluster to restore baseline latency.',
    'AI Incident Commander (Recommendation)',
    mockEvidence,
    { actionId: action1.id }
  );
  assert(approval1.status === 'PENDING', `Approval request is PENDING (got: ${approval1.status})`);
  assert(approval1.actionId === action1.id, 'Approval linked to action');

  const linkedAction1 = await prisma.actionItem.findUnique({ where: { id: action1.id } });
  assert(linkedAction1!.requiresApproval === true, 'Action marked requiresApproval');
  assert(linkedAction1!.approvalId === approval1.id, 'Action linked to approval id');

  // Verify timeline: APPROVAL_REQUESTED exists; no execution event (ACTION_UPDATED)
  const timeline1 = await prisma.timelineEvent.findMany({
    where: {
      incidentId: incident.id,
      relatedEntity: `ActionItem:${action1.id}`,
    },
  });
  const hasApprovalRequested = timeline1.some((e) => e.eventType === 'APPROVAL_REQUESTED');
  const hasExecution = timeline1.some((e) => e.eventType === 'ACTION_UPDATED');
  assert(hasApprovalRequested, 'Timeline has APPROVAL_REQUESTED event');
  assert(!hasExecution, 'No execution timeline event yet');

  // ─── STEP 2: Action blocked by approval gate ────────────────────────────
  console.log('\n━━━ STEP 2: Start action blocked ━━━');
  const blocked = await actionTrackingService.transitionAction(
    action1.id,
    'IN_PROGRESS',
    'Rahul',
    'Starting rollback'
  );
  assert(blocked.success === false, 'Transition blocked without approval');
  assertIncludes(blocked.error || '', 'requires human approval', 'Error mentions approval required');

  // ─── STEP 3: Reject → no execution, action CANCELLED ────────────────────
  console.log('\n━━━ STEP 3: Reject request ━━━');
  const action2 = await actionTrackingService.createActionWithDependencies(
    incident.id,
    'Failover database to DR region',
    'Primary DB latency > 500ms for 10 minutes, initiate DR failover.',
    mockEvidence,
    rahul?.id
  );
  const approval2 = await approvalsService.createRequest(
    incident.id,
    action2.title,
    action2.description,
    'AI Incident Commander (Recommendation)',
    mockEvidence,
    { actionId: action2.id }
  );

  const rejected = await approvalsService.rejectRequest(approval2.id, 'SRE Lead', 'No DR replication lag — do not failover.');
  assert(rejected.status === 'REJECTED', `Approval rejected (got: ${rejected.status})`);

  const rejectedAction = await prisma.actionItem.findUnique({ where: { id: action2.id } });
  assert(rejectedAction!.status === 'CANCELLED', `Action cancelled on reject (got: ${rejectedAction!.status})`);

  // No execution event
  const timeline2 = await prisma.timelineEvent.findMany({
    where: { incidentId: incident.id, relatedEntity: `ActionItem:${action2.id}` },
  });
  const hasRejectTimeline = timeline2.some((e) => e.eventType === 'APPROVAL_REJECTED');
  const hasExec2 = timeline2.some((e) => e.eventType === 'ACTION_UPDATED');
  assert(hasRejectTimeline, 'Timeline has APPROVAL_REJECTED event');
  assert(!hasExec2, 'No execution event after reject');

  // ─── STEP 4: Approve dangerous without CONFIRM → rejected ───────────────
  console.log('\n━━━ STEP 4: Approve dangerous action without CONFIRM ━━━');
  const action3 = await actionTrackingService.createActionWithDependencies(
    incident.id,
    'Restart production API gateway',
    'Restart service to pick up new env config.',
    mockEvidence,
    rahul?.id
  );
  const approval3 = await approvalsService.createRequest(
    incident.id,
    action3.title,
    action3.description,
    'AI Incident Commander (Recommendation)',
    mockEvidence,
    { actionId: action3.id }
  );

  try {
    await approvalsService.approveRequest(approval3.id, 'Incident Commander');
    assert(false, 'Approval without CONFIRM should have thrown');
  } catch (err: any) {
    assertIncludes(err.message, 'CONFIRM', 'Error asks for CONFIRM');
  }

  const stillPending = await prisma.approvalRequest.findUnique({ where: { id: approval3.id } });
  assert(stillPending!.status === 'PENDING', 'Still PENDING after failed approve');

  // ─── STEP 5: Approve with CONFIRM → execution + action IN_PROGRESS ──────
  console.log('\n━━━ STEP 5: Approve dangerous action with CONFIRM ━━━');
  const result = (await approvalsService.approveRequest(approval3.id, 'Incident Commander', 'CONFIRM')) as any;
  assert(result.execution !== undefined, 'Execution result returned');
  assert(result.execution.mock === true, 'Execution is mock (sandbox)');
  assert(typeof result.execution.output === 'string' && result.execution.output.length > 0, 'Execution has output text');
  assertIncludes(result.execution.output, 'restart', 'Mock output mentions restart (sandbox)');

  const approvedAction = await prisma.actionItem.findUnique({ where: { id: action3.id } });
  assert(approvedAction!.status === 'IN_PROGRESS', `Action moved to IN_PROGRESS (got: ${approvedAction!.status})`);

  const timeline3 = await prisma.timelineEvent.findMany({
    where: { incidentId: incident.id, relatedEntity: `ActionItem:${action3.id}` },
  });
  const hasGrant = timeline3.some((e) => e.eventType === 'APPROVAL_GRANTED');
  const hasExecGrant = timeline3.some((e) => e.eventType === 'ACTION_UPDATED');
  assert(hasGrant, 'Timeline has APPROVAL_GRANTED event');
  assert(hasExecGrant, 'Timeline has execution event after approve');

  // ─── STEP 6: Expire → EXPIRED, cannot approve ──────────────────────────
  console.log('\n━━━ STEP 6: Expire request ━━━');
  const action4 = await actionTrackingService.createActionWithDependencies(
    incident.id,
    'Disable checkout feature flag',
    'Disable feature to stop customer-facing errors.',
    mockEvidence,
    rahul?.id
  );
  const approval4 = await approvalsService.createRequest(
    incident.id,
    action4.title,
    action4.description,
    'AI Incident Commander (Recommendation)',
    mockEvidence,
    {
      actionId: action4.id,
      expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
    }
  );

  const expiredCount = await approvalsService.expirePendingApprovals(incident.id);
  assert(expiredCount >= 1, `Expired at least 1 request (got: ${expiredCount})`);

  const expiredRequest = await prisma.approvalRequest.findUnique({ where: { id: approval4.id } });
  assert(expiredRequest!.status === 'EXPIRED', `Request is EXPIRED (got: ${expiredRequest!.status})`);

  try {
    await approvalsService.approveRequest(approval4.id, 'X', 'CONFIRM');
    assert(false, 'Approve after expiry should throw');
  } catch (err: any) {
    assertIncludes(err.message, 'expired', 'Error says expired');
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────
  console.log('\n━━━ CLEANUP ━━━');
  await prisma.incident.delete({ where: { id: incident.id } });
  console.log('  Test incident cleaned up.');

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(` RESULTS: ${PASS} passed, ${FAIL} failed`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });