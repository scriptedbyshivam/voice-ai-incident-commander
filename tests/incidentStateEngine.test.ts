#!/usr/bin/env npx ts-node
// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT STATE ENGINE — Automated Test
//
// This test verifies the 6-step scenario:
// 1. Payment failures increase (observation)
// 2. Engineer reports DB latency (fact report)
// 3. Second engineer reports DB healthy (conflict!)
// 4. Support reports customers saw failure after deployment (hypothesis)
// 5. Rahul is assigned deployment investigation (action)
// 6. Verify final state
// ─────────────────────────────────────────────────────────────────────────────

import { incidentStateEngine } from '../services/incidentStateEngine';
import { incidentStateAggregationService } from '../services/aggregation';
import { IncidentEvent } from '../types/incidentEvents';

const INCIDENT_ID = '288b2653-67c3-44af-8125-5d27aa33f1b8';

// Helper to build a source
function source(speaker: string, role: string, confidence = 0.9): IncidentEvent['source'] {
  return {
    type: 'HUMAN_SPOKEN',
    speakerName: speaker,
    speakerRole: role,
    timestamp: new Date().toISOString(),
    confidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Steps
// ─────────────────────────────────────────────────────────────────────────────

async function step1_observation() {
  console.log('\n━━━ STEP 1: Payment failures increase (OBSERVATION) ━━━');
  const result = await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'OBSERVATION',
    topic: 'Payment API errors increasing',
    statement: 'Payment API is returning 500 errors. Error rate jumped from 0.1% to 15% in the last 10 minutes.',
    source: source('Shivam', 'ENGINEER'),
  });

  console.log(`  Kind: ${result.kind}`);
  console.log(`  State changed: ${result.stateChanged}`);
  console.log(`  Actions:`);
  for (const a of result.actions) {
    console.log(`    [${a.operation}] ${a.entityType}: ${a.reason}`);
  }
  console.log(`  Emitted events: ${result.emittedEvents.map((e) => e.eventName).join(', ')}`);

  console.assert(result.stateChanged === true, 'Step 1: stateChanged should be true');
  console.assert(result.actions.some((a) => a.operation === 'CREATED' && a.entityType === 'FACT'), 'Step 1: should create a FACT');

  return result;
}

async function step2_factReport() {
  console.log('\n━━━ STEP 2: Engineer reports DB latency (FACT_REPORT) ━━━');
  const result = await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'FACT_REPORT',
    topic: 'Database latency',
    statement: 'PostgreSQL connection pool is exhausted. Database CPU is at 95%. Query response time is over 5 seconds.',
    source: source('Amit', 'SRE'),
  });

  console.log(`  Kind: ${result.kind}`);
  console.log(`  State changed: ${result.stateChanged}`);
  console.log(`  Actions:`);
  for (const a of result.actions) {
    console.log(`    [${a.operation}] ${a.entityType}: ${a.reason}`);
  }

  console.assert(result.stateChanged === true, 'Step 2: stateChanged should be true');
  console.assert(result.actions.some((a) => a.operation === 'CREATED' && a.entityType === 'FACT'), 'Step 2: should create a FACT');

  return result;
}

async function step3_conflict() {
  console.log('\n━━━ STEP 3: Second engineer reports DB healthy (CONFLICT!) ━━━');
  const result = await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'FACT_REPORT',
    topic: 'Database latency',
    statement: 'Database CPU is normal at 30%. No latency issues detected. Connection pool is healthy.',
    source: source('Rahul', 'ENGINEER'),
  });

  console.log(`  Kind: ${result.kind}`);
  console.log(`  State changed: ${result.stateChanged}`);
  console.log(`  Actions:`);
  for (const a of result.actions) {
    console.log(`    [${a.operation}] ${a.entityType}: ${a.reason}`);
  }

  // This SHOULD detect a conflict since DB health contradicts step 2
  const hasConflict = result.actions.some((a) => a.operation === 'CONFLICT_DETECTED');
  console.log(`  Conflict detected: ${hasConflict}`);
  console.assert(hasConflict, 'Step 3: should detect CONFLICT');

  return result;
}

async function step4_hypothesis() {
  console.log('\n━━━ STEP 4: Support reports failure after deployment (HYPOTHESIS) ━━━');
  const result = await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'HYPOTHESIS',
    topic: 'Deployment caused outage',
    statement: 'Customers started seeing failures immediately after the v2.3.1 deployment at 14:30 UTC. The deployment may have introduced a regression in the payment processing pipeline.',
    source: source('Priya', 'INCIDENT_COMMANDER'),
    supportingEvidence: ['Error rate increased after deployment', 'Customer reports correlate with deployment time'],
  });

  console.log(`  Kind: ${result.kind}`);
  console.log(`  State changed: ${result.stateChanged}`);
  console.log(`  Actions:`);
  for (const a of result.actions) {
    console.log(`    [${a.operation}] ${a.entityType}: ${a.reason}`);
  }

  console.assert(result.stateChanged === true, 'Step 4: stateChanged should be true');
  console.assert(result.actions.some((a) => a.operation === 'CREATED' && a.entityType === 'HYPOTHESIS'), 'Step 4: should create a HYPOTHESIS');

  return result;
}

async function step5_actionAssignment() {
  console.log('\n━━━ STEP 5: Rahul assigned deployment investigation (ACTION) ━━━');
  const result = await incidentStateEngine.processIncidentEvent(INCIDENT_ID, {
    kind: 'ACTION_ASSIGNMENT',
    topic: 'Investigate deployment',
    statement: 'Rahul to investigate the v2.3.1 deployment. Check deployment logs, compare with previous release, identify any breaking changes in payment processing module.',
    source: source('Priya', 'INCIDENT_COMMANDER'),
    assignee: 'Rahul',
    isCritical: false,
  });

  console.log(`  Kind: ${result.kind}`);
  console.log(`  State changed: ${result.stateChanged}`);
  console.log(`  Actions:`);
  for (const a of result.actions) {
    console.log(`    [${a.operation}] ${a.entityType}: ${a.reason}`);
  }

  console.assert(result.stateChanged === true, 'Step 5: stateChanged should be true');
  console.assert(result.actions.some((a) => a.operation === 'CREATED' && a.entityType === 'ACTION'), 'Step 5: should create an ACTION');

  return result;
}

async function step6_verifyState() {
  console.log('\n━━━ STEP 6: Verify final state ━━━');
  const state = await incidentStateAggregationService.getIncidentState(INCIDENT_ID);

  if (!state) {
    console.error('  FAIL: Could not load incident state');
    return;
  }

  console.log(`  Title: ${state.title}`);
  console.log(`  Status: ${state.currentStatus}`);
  console.log(`  Severity: ${state.severity}`);

  // Facts
  const allFacts = [...state.confirmedFacts, ...state.reportedObservations];
  console.log(`\n  FACTS (${allFacts.length}):`);
  for (const f of allFacts) {
    console.log(`    - [${f.status}] ${f.title}`);
    console.log(`      "${f.description.substring(0, 80)}..."`);
  }

  // Hypotheses
  console.log(`\n  HYPOTHESES (${state.hypotheses.length}):`);
  for (const h of state.hypotheses) {
    console.log(`    - [${h.status}] ${h.title}`);
    console.log(`      "${h.description.substring(0, 80)}..."`);
  }

  // Conflicts
  console.log(`\n  CONFLICTS (${state.conflicts.length}):`);
  for (const c of state.conflicts) {
    console.log(`    - [${c.status}] ${c.topic}`);
    console.log(`      A: "${c.claimA.substring(0, 60)}..."`);
    console.log(`      B: "${c.claimB.substring(0, 60)}..."`);
  }

  // Actions
  console.log(`\n  ACTIONS (${state.actions.length}):`);
  for (const a of state.actions) {
    console.log(`    - [${a.status}] ${a.title} (owner: ${a.assigneeName || 'UNASSIGNED'})`);
  }

  // Open Questions
  console.log(`\n  OPEN QUESTIONS (${state.openQuestions.length}):`);
  for (const q of state.openQuestions) {
    console.log(`    - [${q.resolved ? 'RESOLVED' : 'OPEN'}] ${q.title}`);
  }

  // Timeline
  console.log(`\n  TIMELINE (${state.timeline.length} events):`);
  for (const t of state.timeline.slice(-10)) {
    console.log(`    - [${t.eventType}] ${t.description.substring(0, 80)}`);
  }

  // ─── VERIFICATION ───
  console.log('\n━━━ VERIFICATION ━━━');
  const checks: [string, boolean][] = [
    ['Payment failure fact exists', allFacts.some((f) => f.title.toLowerCase().includes('payment'))],
    ['DB latency observation exists', allFacts.some((f) => f.title.toLowerCase().includes('database'))],
    ['DB conflict detected', state.conflicts.some((c) => c.topic.toLowerCase().includes('database'))],
    ['Deployment hypothesis exists', state.hypotheses.some((h) => h.title.toLowerCase().includes('deployment'))],
    ['Investigation action owned by Rahul', state.actions.some((a) => a.assigneeName === 'Rahul' && a.title.toLowerCase().includes('investigate'))],
    ['Timeline has events', state.timeline.length > 0],
  ];

  let allPassed = true;
  for (const [name, passed] of checks) {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allPassed = false;
  }

  console.log(`\n${allPassed ? '🎉 ALL CHECKS PASSED!' : '❌ SOME CHECKS FAILED!'}`);
  return allPassed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  INCIDENT STATE ENGINE — Automated Test                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    await step1_observation();
    await step2_factReport();
    await step3_conflict();
    await step4_hypothesis();
    await step5_actionAssignment();
    const passed = await step6_verifyState();

    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error('\n💥 TEST FAILED WITH ERROR:', err);
    process.exit(1);
  }
}

main();
