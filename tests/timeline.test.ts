#!/usr/bin/env npx ts-node
// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT TIMELINE ENGINE — Automated Test
//
// Payment outage scenario:
// 10:02 monitoring alert
// 10:05 DB latency report
// 10:07 DB healthy report
// 10:09 customer impact
// 10:15 deployment investigation assigned
// ─────────────────────────────────────────────────────────────────────────────

import { incidentTimelineEngine } from '../src/services/incidentTimelineEngine';
import prisma from '../src/lib/db';

let INCIDENT_ID = '';

let PASS = 0;
let FAIL = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { console.log(`  PASS: ${msg}`); PASS++; }
  else { console.log(`  FAIL: ${msg}`); FAIL++; }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  INCIDENT TIMELINE ENGINE — Automated Test               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Create a dedicated incident so the test is self-contained and idempotent
  const incident = await prisma.incident.create({
    data: { title: 'Timeline Engine Test Incident' },
  });
  INCIDENT_ID = incident.id;

  try {
    await runScenario();
  } finally {
    // Cleanup: cascade removes all timeline events for this incident
    await prisma.incident.delete({ where: { id: INCIDENT_ID } });
    await prisma.$disconnect();
  }
}

async function runScenario() {

  // Create the incident timeline events in chronological order
  console.log('\n━━━ STEP 1: Create 5 timeline events (payment outage scenario) ━━━');

  // 10:02 — Monitoring alert
  const evt1 = await incidentTimelineEngine.createEvent({
    incidentId: INCIDENT_ID,
    eventType: 'ALERT',
    description: 'Payment API error rate exceeded 5% threshold. Alert triggered by monitoring system.',
    sourceType: 'MONITORING',
    sourceId: 'monitor-alert-001',
    speaker: null,
    confidence: 0.95,
    relatedEntity: 'Incident',
    timestamp: new Date('2026-09-01T10:02:00Z'),
  });
  assert(evt1.eventType === 'ALERT', `Event 1 is ALERT (got: ${evt1.eventType})`);
  assert(evt1.sourceType === 'MONITORING', `Source type is MONITORING (got: ${evt1.sourceType})`);
  assert(evt1.confidence === 0.95, `Confidence is 0.95`);
  assert(evt1.relatedEntity === 'Incident', `Related entity is Incident`);
  assert(evt1.timestamp === '2026-09-01T10:02:00.000Z', `Timestamp is 10:02`);

  // 10:05 — DB latency report (human spoken)
  const evt2 = await incidentTimelineEngine.createEvent({
    incidentId: INCIDENT_ID,
    eventType: 'OBSERVATION',
    description: 'Database latency spiking. PostgreSQL response time over 5 seconds.',
    sourceType: 'HUMAN_SPOKEN',
    sourceId: 'transcript-chunk-002',
    speaker: 'Amit',
    speakerRole: 'SRE',
    confidence: 0.9,
    relatedEntity: null,
    timestamp: new Date('2026-09-01T10:05:00Z'),
  });
  assert(evt2.eventType === 'OBSERVATION', `Event 2 is OBSERVATION (got: ${evt2.eventType})`);
  assert(evt2.speaker === 'Amit', `Speaker is Amit (got: ${evt2.speaker})`);
  assert(evt2.timestamp === '2026-09-01T10:05:00.000Z', `Timestamp is 10:05`);

  // 10:07 — DB healthy report (contradicts 10:05 — but different event type)
  const evt3 = await incidentTimelineEngine.createEvent({
    incidentId: INCIDENT_ID,
    eventType: 'OBSERVATION',
    description: 'Database metrics normal. CPU at 30%. No latency issues detected.',
    sourceType: 'HUMAN_SPOKEN',
    sourceId: 'transcript-chunk-003',
    speaker: 'Rahul',
    speakerRole: 'ENGINEER',
    confidence: 0.85,
    relatedEntity: null,
    timestamp: new Date('2026-09-01T10:07:00Z'),
  });
  assert(evt3.eventType === 'OBSERVATION', `Event 3 is OBSERVATION`);
  assert(evt3.speaker === 'Rahul', `Speaker is Rahul`);

  // 10:09 — Customer impact (fact)
  const evt4 = await incidentTimelineEngine.createEvent({
    incidentId: INCIDENT_ID,
    eventType: 'FACT',
    description: 'Customer impact confirmed. 50+ users reported payment failures.',
    sourceType: 'HUMAN_SPOKEN',
    sourceId: 'transcript-chunk-004',
    speaker: 'Priya',
    speakerRole: 'INCIDENT_COMMANDER',
    confidence: 0.95,
    relatedEntity: null,
    timestamp: new Date('2026-09-01T10:09:00Z'),
  });
  assert(evt4.eventType === 'FACT', `Event 4 is FACT`);
  assert(evt4.speaker === 'Priya', `Speaker is Priya`);

  // 10:15 — Deployment investigation assigned (action)
  const evt5 = await incidentTimelineEngine.createEvent({
    incidentId: INCIDENT_ID,
    eventType: 'ACTION_CREATED',
    description: 'Rahul assigned to investigate deployment logs for v2.3.1.',
    sourceType: 'HUMAN_SPOKEN',
    sourceId: 'transcript-chunk-005',
    speaker: 'Priya',
    speakerRole: 'INCIDENT_COMMANDER',
    confidence: 1.0,
    relatedEntity: 'ActionItem',
    timestamp: new Date('2026-09-01T10:15:00Z'),
  });
  assert(evt5.eventType === 'ACTION_CREATED', `Event 5 is ACTION_CREATED`);
  assert(evt5.relatedEntity === 'ActionItem', `Related entity is ActionItem`);

  // ─── STEP 2: Verify chronological order ───
  console.log('\n━━━ STEP 2: Verify chronological order ━━━');
  const chrono = await incidentTimelineEngine.getIncidentTimeline(INCIDENT_ID, {
    order: 'chronological',
    limit: 10,
  });
  assert(chrono.events.length === 5, `Timeline has 5 events (got: ${chrono.events.length})`);

  // Verify timestamps are in chronological order
  for (let i = 0; i < chrono.events.length - 1; i++) {
    const t1 = new Date(chrono.events[i].eventTime).getTime();
    const t2 = new Date(chrono.events[i + 1].eventTime).getTime();
    assert(t1 <= t2, `Event ${i} (${chrono.events[i].eventTime}) <= Event ${i+1} (${chrono.events[i+1].eventTime})`);
  }

  // ─── STEP 3: Verify latest order ───
  console.log('\n━━━ STEP 3: Verify latest order ━━━');
  const latest = await incidentTimelineEngine.getIncidentTimeline(INCIDENT_ID, {
    order: 'latest',
    limit: 10,
  });
  assert(latest.events.length === 5, `Latest view has 5 events`);
  // Latest order = descending
  for (let i = 0; i < latest.events.length - 1; i++) {
    const t1 = new Date(latest.events[i].eventTime).getTime();
    const t2 = new Date(latest.events[i + 1].eventTime).getTime();
    assert(t1 >= t2, `Event ${i} >= Event ${i+1} in latest order`);
  }

  // ─── STEP 4: Filter by event type ───
  console.log('\n━━━ STEP 4: Filter by event type ━━━');
  const alerts = await incidentTimelineEngine.getTimelineByType(INCIDENT_ID, 'ALERT');
  assert(alerts.length === 1, `1 ALERT event (got: ${alerts.length})`);
  assert(alerts[0].description.includes('error rate'), 'ALERT description matches');

  const observations = await incidentTimelineEngine.getTimelineByType(INCIDENT_ID, 'OBSERVATION');
  assert(observations.length === 2, `2 OBSERVATION events (got: ${observations.length})`);

  const facts = await incidentTimelineEngine.getTimelineByType(INCIDENT_ID, 'FACT');
  assert(facts.length === 1, `1 FACT event`);

  const actions = await incidentTimelineEngine.getTimelineByType(INCIDENT_ID, 'ACTION_CREATED');
  assert(actions.length === 1, `1 ACTION_CREATED event`);

  // ─── STEP 5: Verify all fields present ───
  console.log('\n━━━ STEP 5: Verify all fields present ━━━');
  const allEvents = await incidentTimelineEngine.getIncidentTimeline(INCIDENT_ID, { limit: 10 });
  for (const evt of allEvents.events) {
    assert(evt.id !== undefined && evt.id.length > 0, `Event ${evt.eventType} has id`);
    assert(evt.eventType !== undefined, `Event has eventType`);
    assert(evt.description !== undefined && evt.description.length > 0, `Event has description`);
    assert(evt.sourceType !== undefined, `Event has sourceType`);
    assert(evt.sourceId !== undefined, `Event has sourceId`);
    assert(evt.speaker !== undefined, `Event has speaker`);
    assert(evt.confidence !== undefined, `Event has confidence`);
    assert(evt.relatedEntity !== undefined, `Event has relatedEntity`);
    assert(evt.eventTime !== undefined, `Event has eventTime`);
    assert(evt.createdAt !== undefined, `Event has createdAt`);
  }

  // ─── STEP 6: Verify source filtering ───
  console.log('\n━━━ STEP 6: Filter by source type ━━━');
  const humanSpoken = await incidentTimelineEngine.getIncidentTimeline(INCIDENT_ID, {
    sourceType: 'HUMAN_SPOKEN',
    limit: 10,
  });
  assert(humanSpoken.events.length === 4, `4 HUMAN_SPOKEN events (got: ${humanSpoken.events.length})`);

  const monitoring = await incidentTimelineEngine.getIncidentTimeline(INCIDENT_ID, {
    sourceType: 'MONITORING',
    limit: 10,
  });
  assert(monitoring.events.length === 1, `1 MONITORING event`);

  // ─── STEP 7: Verify time range filter ───
  console.log('\n━━━ STEP 7: Filter by time range ━━━');
  const timeRange = await incidentTimelineEngine.getTimelineByTimeRange(
    INCIDENT_ID,
    new Date('2026-09-01T10:04:00Z'),
    new Date('2026-09-01T10:10:00Z')
  );
  assert(timeRange.length === 3, `3 events in time range (got: ${timeRange.length})`);

  // ─── STEP 8: Verify invalid event type rejected ───
  console.log('\n━━━ STEP 8: Invalid event type rejected ━━━');
  try {
    await incidentTimelineEngine.createEvent({
      incidentId: INCIDENT_ID,
      eventType: 'INVALID_TYPE',
      description: 'Test',
      sourceType: 'MONITORING',
      confidence: 0.5,
    });
    assert(false, 'Should have thrown for invalid event type');
  } catch (err: any) {
    assert(err.message?.includes('Invalid event type'), `Error: ${err.message}`);
  }

  // ─── STEP 9: Verify invalid source type rejected ───
  console.log('\n━━━ STEP 9: Invalid source type rejected ━━━');
  try {
    await incidentTimelineEngine.createEvent({
      incidentId: INCIDENT_ID,
      eventType: 'ALERT',
      description: 'Test',
      sourceType: 'INVALID_SOURCE' as any,
      confidence: 0.5,
    });
    assert(false, 'Should have thrown for invalid source type');
  } catch (err: any) {
    assert(err.message?.includes('Invalid source type'), `Error: ${err.message}`);
  }

  // ─── STEP 10: Verify no fabricated timestamps ───
  console.log('\n━━━ STEP 10: Timestamp validation ━━━');
  // Future timestamp should be clamped to now
  const futureEvt = await incidentTimelineEngine.createEvent({
    incidentId: INCIDENT_ID,
    eventType: 'ALERT',
    description: 'Test future timestamp',
    sourceType: 'MONITORING',
    timestamp: new Date('2099-01-01T00:00:00Z'),
    confidence: 0.5,
  });
  const evtTime = new Date(futureEvt.timestamp);
  const now = new Date();
  assert(evtTime <= now, 'Future timestamp was clamped to now');

  // ─── STEP 11: Verify hasEvents ───
  console.log('\n━━━ STEP 11: hasEvents check ━━━');
  const hasEvents = await incidentTimelineEngine.hasEvents(INCIDENT_ID);
  assert(hasEvents === true, 'Incident has timeline events');

  // ─── Summary ───
  console.log('\n━━━ DASHBOARD SUMMARY ━━━');
  console.log(`  All 5 events created with correct types, sources, speakers, timestamps`);
  console.log(`  Chronological and latest ordering verified`);
  console.log(`  Filtering by event type and source type working`);
  console.log(`  Time range filtering working`);
  console.log(`  Invalid event types and source types rejected`);
  console.log(`  Future timestamps clamped to now`);
  console.log(`  All required fields present on every event`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(` RESULTS: ${PASS} passed, ${FAIL} failed`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });