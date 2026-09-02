#!/usr/bin/env npx ts-node
// ─────────────────────────────────────────────────────────────────────────────
// UNCERTAINTY HANDLING — Automated Test
//
// Payment outage scenario:
// 1. Payment failures increase
// 2. Engineer reports DB latency
// 3. Second engineer reports DB healthy (CONFLICT)
// 4. Support reports failure after deployment
// 5. Rahul assigned investigation
// 6. Verify uncertainty dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { incidentStateEngine } from '@/services/incidentStateEngine';
import { uncertaintyService } from '@/services/uncertainty';
import { incidentStateAggregationService } from '@/services/aggregation';

const INCIDENT_ID = '288b2653-67c3-44af-8125-5d27aa33f1b8';

function src(speaker: string, role: string, confidence = 0.9): any {
  return { type: 'HUMAN_SPOKEN', speakerName: speaker, speakerRole: role, timestamp: new Date().toISOString(), confidence };
}

let PASS = 0;
let FAIL = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { console.log(`  PASS: ${msg}`); PASS++; }
  else { console.log(`  FAIL: ${msg}`); FAIL++; }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  UNCERTAINTY HANDLING — Automated Test                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ─── Step 1: Payment failures ───
  console.log('\n━━━ STEP 1: Payment failures increase ━━━');
  await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'FACT_REPORT', topic: 'Payment API errors',
    statement: 'Payment API returning 500 errors. Error rate 15%.',
    source: src('Shivam', 'ENGINEER'),
  });

  // ─── Step 2: DB latency ───
  console.log('━━━ STEP 2: Engineer reports DB latency ━━━');
  await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'FACT_REPORT', topic: 'Database latency',
    statement: 'PostgreSQL connection pool exhausted. CPU at 95%.',
    source: src('Amit', 'SRE'),
  });

  // ─── Step 3: DB healthy (CONFLICT!) ───
  console.log('━━━ STEP 3: Engineer reports DB healthy (CONFLICT) ━━━');
  await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'FACT_REPORT', topic: 'Database latency',
    statement: 'Database CPU normal at 30%. Connection pool healthy.',
    source: src('Rahul', 'ENGINEER'),
  });

  // ─── Step 4: Deployment hypothesis ───
  console.log('━━━ STEP 4: Deployment hypothesis ━━━');
  await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'HYPOTHESIS', topic: 'Deployment caused outage',
    statement: 'Customers saw failures immediately after v2.3.1 deployment at 14:30 UTC.',
    source: src('Priya', 'INCIDENT_COMMANDER'),
  });

  // ─── Step 5: Unassigned action ───
  console.log('━━━ STEP 5: Unassigned action ━━━');
  await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'ACTION_ASSIGNMENT', topic: 'Check error logs',
    statement: 'Someone needs to check the error logs for the payment service.',
    source: src('Priya', 'INCIDENT_COMMANDER'),
    assignee: 'UNASSIGNED',
  });

  // ─── Step 6: Verify state ───
  console.log('\n━━━ STEP 6: Verify incident state ━━━');
  const state = await incidentStateAggregationService.getIncidentState(INCIDENT_ID);
  if (!state) { console.error('FATAL: Could not load state'); process.exit(1); }

  console.log(`  Title: ${state.title}`);
  console.log(`  Facts: ${state.reportedObservations.length}`);
  console.log(`  Hypotheses: ${state.hypotheses.length}`);
  console.log(`  Conflicts: ${state.conflicts.length}`);
  console.log(`  Actions: ${state.actions.length}`);

  // ─── Step 7: Run uncertainty scan ───
  console.log('\n━━━ STEP 7: Uncertainty Dashboard Scan ━━━');
  const dashboard = await uncertaintyService.scanIncident(INCIDENT_ID);

  console.log(`  Total signals: ${dashboard.summary.total}`);
  console.log(`  HIGH: ${dashboard.summary.high}`);
  console.log(`  MEDIUM: ${dashboard.summary.medium}`);
  console.log(`  LOW: ${dashboard.summary.low}`);

  // Verify signals
  assert(dashboard.summary.total > 0, 'Should detect uncertainty signals');
  assert(dashboard.conflicts.filter((c) => c.status === 'UNRESOLVED').length >= 1, 'Should have unresolved conflict (DB latency)');
  assert(dashboard.unassignedActions.length >= 1, 'Should have unassigned action');
  assert(dashboard.unverifiedHypotheses.length >= 1, 'Should have unverified hypothesis (deployment)');

  // Verify conflict signal
  const conflictSignals = dashboard.signals.filter((s) => s.kind === 'CONFLICT');
  assert(conflictSignals.length >= 1, 'Should have CONFLICT signal');

  // Verify missing info signal
  const missingSignals = dashboard.signals.filter((s) => s.kind === 'MISSING_INFO');
  console.log(`\n  Missing info signals: ${missingSignals.length}`);
  for (const s of missingSignals) {
    console.log(`    - [${s.severity}] ${s.topic}`);
    console.log(`      ${s.recommendation.substring(0, 80)}`);
  }

  // Verify ownership signal
  const ownershipSignals = dashboard.signals.filter((s) => s.kind === 'UNASSIGNED_ACTION');
  assert(ownershipSignals.length >= 1, 'Should have UNASSIGNED_ACTION signal');

  // Verify hypothesis signal
  const hypothesisSignals = dashboard.signals.filter((s) => s.kind === 'UNRESOLVED_DECISION');
  console.log(`\n  Unresolved hypothesis signals: ${hypothesisSignals.length}`);
  for (const s of hypothesisSignals) {
    console.log(`    - [${s.severity}] ${s.topic}`);
  }

  // ─── Step 8: Verify hypothesis is NOT confirmed ───
  console.log('\n━━━ STEP 8: Verify hypothesis lifecycle ━━━');
  const deploymentHypothesis = state.hypotheses.find((h) => h.title.toLowerCase().includes('deployment'));
  assert(deploymentHypothesis !== undefined, 'Deployment hypothesis exists');
  if (deploymentHypothesis) {
    assert(deploymentHypothesis.status === 'UNCONFIRMED', `Hypothesis is UNCONFIRMED (got: ${deploymentHypothesis.status})`);
  }

  // ─── Step 9: Verify determinstic conflict detection ───
  console.log('\n━━━ STEP 9: Deterministic conflict detection ━━━');
  const conflicts = await uncertaintyService.detectConflictsDeterministic(
    INCIDENT_ID,
    'Database latency',
    'Database CPU at 100%. All connections timing out.'
  );
  assert(conflicts.length >= 1, `Deterministic detection found ${conflicts.length} conflict(s)`);

  // ─── Step 10: Verify AI clarification question ───
  console.log('\n━━━ STEP 10: AI clarification question ━━━');
  const { aiProvider } = await import('@/services/ai');
  const stateText = [
    `Incident: ${state.title}`,
    `Conflicts: ${state.conflicts.length} unresolved`,
    `Hypotheses: ${state.hypotheses.length} unverified`,
    `Actions: ${state.actions.length} (${state.actions.filter((a) => !a.assigneeId).length} unassigned)`,
  ].join('\n');
  const question = await aiProvider.generateClarificationQuestion(stateText);
  assert(question.questionText.length > 10, `Question generated: "${question.questionText.substring(0, 60)}..."`);
  assert(question.questionText.length < 200, 'Question is concise (< 200 chars)');

  // ─── Summary ───
  console.log('\n━━━ DASHBOARD SUMMARY ━━━');
  console.log(`  Conflicts: ${dashboard.conflicts.length} (${dashboard.conflicts.filter((c) => c.status === 'UNRESOLVED').length} unresolved)`);
  console.log(`  Open Questions: ${dashboard.openQuestions.filter((q) => !q.resolved).length}`);
  console.log(`  Unassigned Actions: ${dashboard.unassignedActions.length}`);
  console.log(`  Stale Facts: ${dashboard.staleFacts.length}`);
  console.log(`  Unverified Hypotheses: ${dashboard.unverifiedHypotheses.length}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(` RESULTS: ${PASS} passed, ${FAIL} failed`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
