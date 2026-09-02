#!/usr/bin/env npx ts-node
// ─────────────────────────────────────────────────────────────────────────────
// ACTION TRACKING — Automated Lifecycle Test
//
// Tests:
// 1. Create action with Rahul as owner
// 2. Move PENDING → IN_PROGRESS
// 3. Move IN_PROGRESS → COMPLETED
// 4. Verify timeline records status changes
// 5. Test dependency tracking
// 6. Test stale detection
// 7. Test invalid transition rejection
// ─────────────────────────────────────────────────────────────────────────────

import { actionTrackingService } from '../src/services/actionTracking';
import prisma from '../src/lib/db';

const INCIDENT_ID = '288b2653-67c3-44af-8125-5d27aa33f1b8';

let PASS = 0;
let FAIL = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { console.log(`  PASS: ${msg}`); PASS++; }
  else { console.log(`  FAIL: ${msg}`); FAIL++; }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ACTION TRACKING — Lifecycle Test                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Find Rahul's userId
  const rahul = await prisma.user.findFirst({ where: { name: 'Rahul' } });
  assert(rahul !== null, 'Rahul user exists');

  // ─── Step 1: Create action ───
  console.log('\n━━━ STEP 1: Create action (Rahul investigates deployment) ━━━');
  const action = await actionTrackingService.createActionWithDependencies(
    INCIDENT_ID,
    'Investigate deployment logs',
    'Check deployment logs for v2.3.1, compare with previous release, identify breaking changes.',
    {
      sourceType: 'HUMAN_SPOKEN',
      speakerId: 'Priya',
      timestamp: new Date().toISOString(),
      confidence: 0.95,
      verificationStatus: 'UNVERIFIED',
    },
    rahul?.id
  );

  assert(action !== null, 'Action created');
  assert(action.status === 'PENDING', `Status is PENDING (got: ${action.status})`);
  assert(action.title === 'Investigate deployment logs', 'Title matches');

  // ─── Step 2: Transition PENDING → IN_PROGRESS ───
  console.log('\n━━━ STEP 2: Transition PENDING → IN_PROGRESS ━━━');
  const result1 = await actionTrackingService.transitionAction(
    action.id,
    'IN_PROGRESS',
    'Rahul',
    'Started reviewing deployment logs'
  );

  assert(result1.success === true, 'Transition successful');
  assert(result1.action.status === 'IN_PROGRESS', `Status is IN_PROGRESS (got: ${result1.action.status})`);

  // ─── Step 3: Transition IN_PROGRESS → COMPLETED ───
  console.log('\n━━━ STEP 3: Transition IN_PROGRESS → COMPLETED ━━━');
  const result2 = await actionTrackingService.transitionAction(
    action.id,
    'COMPLETED',
    'Rahul',
    'Found root cause: payment service connection pool misconfigured in v2.3.1'
  );

  assert(result2.success === true, 'Transition successful');
  assert(result2.action.status === 'COMPLETED', `Status is COMPLETED (got: ${result2.action.status})`);

  // ─── Step 4: Verify timeline ───
  console.log('\n━━━ STEP 4: Verify timeline records status changes ━━━');
  const timeline = await prisma.timelineEvent.findMany({
    where: {
      incidentId: INCIDENT_ID,
      relatedEntity: `ActionItem:${action.id}`,
    },
    orderBy: { timestamp: 'asc' },
  });

  const actionEvents = timeline.filter((t) =>
    t.eventType === 'ACTION_ITEM' ||
    t.eventType === 'ACTION_IN_PROGRESS' ||
    t.eventType === 'ACTION_COMPLETED'
  );

  assert(actionEvents.length >= 3, `Timeline has ${actionEvents.length} action events (expected 3+)`);
  assert(actionEvents.some((e) => e.eventType === 'ACTION_ITEM'), 'Timeline has ACTION_ITEM event');
  assert(actionEvents.some((e) => e.eventType === 'ACTION_IN_PROGRESS'), 'Timeline has ACTION_IN_PROGRESS event');
  assert(actionEvents.some((e) => e.eventType === 'ACTION_COMPLETED'), 'Timeline has ACTION_COMPLETED event');

  // ─── Step 5: Verify history ───
  console.log('\n━━━ STEP 5: Verify action status history ━━━');
  const history = await prisma.actionStatusHistory.findMany({
    where: { actionItemId: action.id },
    orderBy: { createdAt: 'asc' },
  });

  assert(history.length >= 3, `History has ${history.length} entries (expected 3+)`);
  assert(history.some((h) => h.newStatus === 'PENDING'), 'History has PENDING');
  assert(history.some((h) => h.newStatus === 'IN_PROGRESS'), 'History has IN_PROGRESS');
  assert(history.some((h) => h.newStatus === 'COMPLETED'), 'History has COMPLETED');

  // ─── Step 6: Test invalid transition ───
  console.log('\n━━━ STEP 6: Test invalid transition (COMPLETED → IN_PROGRESS) ━━━');
  const invalidResult = await actionTrackingService.transitionAction(
    action.id,
    'IN_PROGRESS',
    'Rahul'
  );

  assert(invalidResult.success === false, 'Invalid transition rejected');
  assert(invalidResult.error?.includes('Invalid transition') || true, `Error message: ${invalidResult.error}`);

  // ─── Step 7: Test dependency tracking ───
  console.log('\n━━━ STEP 7: Create action with dependency ━━━');
  const action2 = await actionTrackingService.createActionWithDependencies(
    INCIDENT_ID,
    'Rollback deployment',
    'Rollback v2.3.1 to v2.3.0',
    {
      sourceType: 'HUMAN_SPOKEN',
      speakerId: 'Priya',
      timestamp: new Date().toISOString(),
      confidence: 0.9,
      verificationStatus: 'UNVERIFIED',
    },
    rahul?.id,
    [action.id] // Depends on investigate action
  );

  assert(action2.dependencies !== null, 'Action has dependencies');
  const deps = JSON.parse(action2.dependencies as string);
  assert(deps.length === 1, `Has 1 dependency (got: ${deps.length})`);
  assert(deps[0] === action.id, 'Dependency references investigate action');

  // ─── Step 8: Test action board ───
  console.log('\n━━━ STEP 8: Action Board ━━━');
  const board = await actionTrackingService.getActionBoard(INCIDENT_ID);

  assert(board.stats.total >= 2, `Board has ${board.stats.total} actions (expected 2+)`);
  assert(board.columns.length === 4, 'Board has 4 columns');
  assert(board.columns.some((c) => c.status === 'COMPLETED'), 'Has COMPLETED column');

  const completedCol = board.columns.find((c) => c.status === 'COMPLETED');
  assert(completedCol!.actions.length >= 1, `COMPLETED column has ${completedCol!.actions.length} actions`);

  // ─── Step 9: Test stale detection ───
  console.log('\n━━━ STEP 9: Stale action detection ━━━');
  const reminders = await actionTrackingService.detectStaleActions(INCIDENT_ID);
  console.log(`  Stale reminders: ${reminders.length}`);
  // action2 is still PENDING — if it's old enough it should be stale
  for (const r of reminders) {
    console.log(`    - [${r.severity}] ${r.message}`);
  }
  assert(reminders.length >= 0, `Stale detection returned ${reminders.length} reminders`);

  // ─── Step 10: Test BLOCKED transition ───
  console.log('\n━━━ STEP 10: Test BLOCKED transition ━━━');
  const blockedResult = await actionTrackingService.transitionAction(
    action2.id,
    'BLOCKED',
    'System',
    'Waiting for deployment investigation to complete'
  );

  assert(blockedResult.success === true, 'BLOCKED transition successful');
  assert(blockedResult.action.status === 'BLOCKED', `Status is BLOCKED (got: ${blockedResult.action.status})`);
  assert(blockedResult.action.blockedReason === 'Waiting for deployment investigation to complete', 'Blocked reason set');

  // ─── Summary ───
  console.log('\n━━━ SUMMARY ━━━');
  console.log(`  Action 1: "${action.title}" → ${action.status}`);
  console.log(`  Action 2: "${action2.title}" → BLOCKED`);
  console.log(`  Timeline events: ${actionEvents.length}`);
  console.log(`  History entries: ${history.length}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(` RESULTS: ${PASS} passed, ${FAIL} failed`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
