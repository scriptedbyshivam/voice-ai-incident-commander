#!/usr/bin/env npx ts-node
// ─────────────────────────────────────────────────────────────────────────────
// AI SPOKEN PARTICIPATION — Automated Test
//
// Verifies the deterministic speech engine: WHEN the AI Incident Commander
// decides to speak and WHAT it says. Pure engine tests — no DB/TTS required.
//
// Scenario focus: a live bridge where two engineers contradict each other
// about database latency, the commander must voice the conflict and ask for
// the current monitoring value.
// ─────────────────────────────────────────────────────────────────────────────

import { IncidentState } from '../src/types/incident';
import {
  evaluateForSpeech,
  buildStatusRequestIntent,
  buildPeriodicStatusIntent,
  phraseConflict,
  phraseHypothesis,
  phraseMissingEvidence,
  phraseAllClear,
  formatStatusSummary,
} from '../src/services/aiSpeechEngine';

let PASS = 0;
let FAIL = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    PASS++;
    return;
  }
  console.log(`  FAIL: ${msg}`);
  FAIL++;
}

function assertTrue(condition: boolean, msg: string) {
  assert(condition, msg);
}
function assertFalse(condition: boolean, msg: string) {
  assert(!condition, msg);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<IncidentState> = {}): IncidentState {
  const base: IncidentState = {
    incidentId: 'inc-test',
    title: 'Database Latency Outage',
    description: 'Checkout failures on payment cluster.',
    currentStatus: 'ACTIVE',
    severity: 'SEV1',
    createdAt: new Date().toISOString(),
    participants: [
      {
        id: 'p-rahul',
        userId: 'u-rahul',
        name: 'Rahul Sharma',
        role: 'ENGINEER',
        joinedAt: new Date().toISOString(),
      },
    ],
    confirmedFacts: [],
    reportedObservations: [],
    hypotheses: [],
    decisions: [],
    actions: [],
    conflicts: [],
    openQuestions: [],
    unresolvedRisks: [],
    timeline: [],
    latestSummary: null,
  };
  return { ...base, ...overrides };
}

function conflictState(topic: string, claimA: string, claimB: string): IncidentState {
  const s = makeState();
  s.conflicts = [
    {
      id: 'c-1',
      topic,
      claimA,
      claimB,
      sourceA: {
        sourceType: 'HUMAN_SPOKEN',
        speakerId: 'u-rahul',
        sourceText: claimA,
        timestamp: new Date().toISOString(),
        confidence: 0.85,
        verificationStatus: 'DISPUTED',
      },
      sourceB: {
        sourceType: 'HUMAN_SPOKEN',
        speakerId: 'u-amit',
        sourceText: claimB,
        timestamp: new Date().toISOString(),
        confidence: 0.8,
        verificationStatus: 'DISPUTED',
      },
      status: 'UNRESOLVED',
      detectedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  return s;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AI SPOKEN PARTICIPATION — Speech Engine Test            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ─── 1. Conflict detection — THE core scenario ────────────────────────────
  console.log('\n━━━ 1: CONFLICT DETECTED — the commander voices the contradiction ━━━');

  const beforeConflict = makeState();
  const afterConflict = conflictState(
    'Database latency',
    'Engineer A reports high DB latency of 800ms+ in the app server logs.',
    'Engineer B reports the Grafana read charts look normal at under 15ms.'
  );

  const conflictIntent = evaluateForSpeech(beforeConflict, afterConflict);
  assert(conflictIntent !== null, 'evaluateForSpeech returns an intent after a new conflict');
  if (conflictIntent) {
    assertTrue(conflictIntent.trigger === 'CONFLICT_DETECTED', 'trigger is CONFLICT_DETECTED');
    assertTrue(conflictIntent.category === 'ALERT', 'category is ALERT');
    const text = conflictIntent.text;
    assertTrue(
      text.includes("I've detected conflicting reports about database latency"),
      'text leads with "I\'ve detected conflicting reports about database latency"'
    );
    assertTrue(
      text.includes("One source says: Engineer A reports high DB latency"),
      'text attributes the first claim'
    );
    assertTrue(
      text.includes('Another says: Engineer B reports the Grafana read charts'),
      'text attributes the contradictory claim'
    );
    assertTrue(
      text.includes('Can someone confirm the current monitoring value?'),
      'text asks for the current monitoring value'
    );
    // A conflict that already existed in the previous snapshot must NOT re-trigger.
    const replay = evaluateForSpeech(afterConflict, afterConflict);
    assertTrue(replay === null, 'the same conflict is never announced twice (idempotent)');
  }

  // ─── 2. Silence on routine transcripts ────────────────────────────────────
  console.log('\n━━━ 2: NO SPEECH on routine transcript additions ━━━');

  const quietPrev = makeState();
  const quietNext = makeState();
  quietNext.confirmedFacts = [
    {
      id: 'f-1',
      title: 'Checkout failure spike',
      description: 'Failure rate at 42%.',
      status: 'CONFIRMED',
      evidence: {
        sourceType: 'MONITORING',
        sourceText: 'checkout.payment.failure.rate > 40%',
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  // Same conflict set, same status, same severity — nothing material changed.
  quietNext.conflicts = quietPrev.conflicts.map((c) => ({ ...c }));

  const noIntent = evaluateForSpeech(quietPrev, quietNext);
  assertTrue(noIntent === null, 'adding a routine fact does NOT make the AI speak');

  // Same state twice → silence.
  assertTrue(
    evaluateForSpeech(afterConflict, JSON.parse(JSON.stringify(afterConflict))) === null,
    'identical state snapshots produce no intent'
  );

  // ─── 3. DECISION / ACTION / STATE change triggers ─────────────────────────
  console.log('\n━━━ 3: DECISION, ACTION, and STATE CHANGE triggers ━━━');

  const preDecision = makeState();
  const postDecision = makeState();
  postDecision.decisions = [
    {
      id: 'd-1',
      title: 'Rollback canary deployment v2.4.1',
      description: 'Proposed rolling back the payment-routing canary to restore baseline.',
      decidedBy: 'Rahul Sharma',
      evidence: {
        sourceType: 'MANUAL_CONFIRMATION',
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const decisionIntent = evaluateForSpeech(preDecision, postDecision);
  assertTrue(decisionIntent?.trigger === 'DECISION_DISCUSSED', 'critical decision triggers DECISION_DISCUSSED');
  if (decisionIntent) {
    assertTrue(
      decisionIntent.text.includes('A decision is being discussed'),
      'decision phrasing is conversational, not authoritative'
    );
  }

  const preAction = makeState();
  const postAction = makeState();
  postAction.actions = [
    {
      id: 'a-1',
      title: 'Execute canary rollback script',
      description: 'Roll back payment-routing canary.',
      status: 'PENDING',
      assigneeName: 'Rahul Sharma',
      assigneeId: 'p-rahul',
      evidence: {
        sourceType: 'MANUAL_CONFIRMATION',
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        verificationStatus: 'VERIFIED',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const actionIntent = evaluateForSpeech(preAction, postAction);
  assertTrue(actionIntent?.trigger === 'ACTION_ASSIGNED', 'assigned action triggers ACTION_ASSIGNED');
  if (actionIntent) {
    assertTrue(actionIntent.text.includes('Rahul Sharma is the owner'), 'action intent names the owner');
  }

  const preState = makeState();
  const postState = makeState({ currentStatus: 'RESOLVED' });
  const stateIntent = evaluateForSpeech(preState, postState);
  assertTrue(stateIntent?.trigger === 'INCIDENT_STATE_CHANGE', 'status change triggers INCIDENT_STATE_CHANGE');
  if (stateIntent) {
    assertTrue(
      stateIntent.text.includes('Incident status has changed from ACTIVE to RESOLVED'),
      'state-change phrasing is factual and measured'
    );
  }

  // ─── 4. Priority — conflict message wins over other simultaneous triggers ──
  console.log('\n━━━ 4: PRIORITY — one message, not a wall of alerts ━━━');

  const mixedPrev = makeState();
  const mixedNext = conflictState(
    'Database latency',
    'Engineer A reports 800ms+ in app server logs.',
    'Engineer B reports normal read charts (<15ms).'
  );
  mixedNext.currentStatus = 'RESOLVED'; // state change also happens — must NOT be spoken
  mixedNext.decisions = [
    {
      id: 'd-x',
      title: 'Investigate connection pool saturation',
      description: 'Supersede conflict with a fresh hypothesis.',
      decidedBy: 'Priya Patel',
      evidence: { sourceType: 'MANUAL_CONFIRMATION', timestamp: new Date().toISOString(), confidence: 1.0, verificationStatus: 'VERIFIED' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const winner = evaluateForSpeech(mixedPrev, mixedNext);
  assertTrue(winner?.trigger === 'CONFLICT_DETECTED', 'CONFLICT_DETECTED (priority 100) is spoken over state change (60) and decision (80)');

  // ─── 5. Status requests & periodic summaries ──────────────────────────────
  console.log('\n━━━ 5: STATUS SUMMARIES — concise, structured, bounded ━━━');

  const statusState = conflictState('Database latency', '800ms+ from logs.', 'Charts look normal.');
  statusState.confirmedFacts = [
    {
      id: 'f-1',
      title: 'Checkout Failure Spike',
      description: 'Payment failure rate at 42%.',
      status: 'CONFIRMED',
      evidence: { sourceType: 'MONITORING', timestamp: new Date().toISOString(), confidence: 1.0, verificationStatus: 'VERIFIED' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  statusState.hypotheses = [
    {
      id: 'h-1',
      title: 'Connection pool exhaustion',
      description: 'Suspect connection pool exhaustion in the checkout service.',
      status: 'REPORTED',
      evidence: { sourceType: 'HUMAN_SPOKEN', speakerId: 'u-rahul', timestamp: new Date().toISOString(), confidence: 0.6, verificationStatus: 'UNVERIFIED' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  statusState.actions = [
    {
      id: 'a-1',
      title: 'Restart checkout workers',
      description: 'Restart the checkout worker pool.',
      status: 'IN_PROGRESS',
      assigneeName: 'Amit Kumar',
      evidence: { sourceType: 'MANUAL_CONFIRMATION', timestamp: new Date().toISOString(), confidence: 1.0, verificationStatus: 'VERIFIED' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const requested = buildStatusRequestIntent(statusState);
  assertTrue(requested.trigger === 'USER_REQUESTED_STATUS', 'explicit request maps to USER_REQUESTED_STATUS');
  assertTrue(requested.category === 'STATUS_SUMMARY', 'requested status is a STATUS_SUMMARY');
  assertTrue(
    requested.text.includes('Confirmed:') &&
      requested.text.includes('Active hypotheses:') &&
      requested.text.includes('Actions:') &&
      requested.text.includes('Unresolved:'),
    'status summary contains all four sections (Confirmed / Hypotheses / Actions / Unresolved)'
  );
  assertTrue(requested.text.includes('Payment failure rate at 42%'), 'summary cites the confirmed monitoring fact');
  assertTrue(requested.text.includes('Conflicting reports on database latency'), 'summary surfaces the unresolved conflict');

  const periodic = buildPeriodicStatusIntent(statusState);
  assertTrue(periodic.trigger === 'PERIODIC_STATUS', 'periodic update maps to PERIODIC_STATUS');
  assertTrue(periodic.text.length <= 501, `periodic status stays under ~30s (length ${periodic.text.length})`);

  const minimal = formatStatusSummary(makeState());
  assertTrue(
    minimal.includes('No confirmed facts yet.') &&
      minimal.includes('No active hypotheses.') &&
      minimal.includes('No outstanding actions.') &&
      minimal.includes('No unresolved conflicts or questions.'),
    'empty-state summary degrades gracefully with honest "none" phrasing'
  );

  // ─── 6. Voice personality — never declare a root cause ────────────────────
  console.log('\n━━━ 6: VOICE PERSONALITY — evidence-aware, never authoritative ━━━');

  const hyp = phraseHypothesis('Some network issue maybe causing saturation.');
  assertFalse(/root cause/i.test(hyp), 'hypothesis phrasing avoids "root cause" claims');

  const missing = phraseMissingEvidence('the database slowness');
  assertFalse(/root cause/i.test(missing), 'missing-evidence phrasing avoids "root cause" claims');
  assertTrue(missing.includes('We do not yet have enough evidence'), 'phrasing is honest about uncertainty');

  const allClear = phraseAllClear();
  assertTrue(allClear.includes('no new alerts'), 'all-clear is calm and brief');

  const directText = phraseConflict(
    conflictState('Database latency', 'Logs show 800ms latency.', 'Dashboard shows 15ms read latency.').conflicts[0]
  );
  assertTrue(
    directText ===
      "I've detected conflicting reports about database latency. One source says: Logs show 800ms latency.. Another says: Dashboard shows 15ms read latency.. Can someone confirm the current monitoring value?",
    'conflict utterance is EXACTLY the contract string the demo expects'
  );

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`  RESULT: ${PASS} passed, ${FAIL} failed`);
  console.log('──────────────────────────────────────────────────────────');

  if (FAIL > 0) {
    console.error('\n❌ AI SPEECH ENGINE TEST FAILED');
    process.exit(1);
  }
  console.log('\n✅ AI SPEECH ENGINE TEST PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});