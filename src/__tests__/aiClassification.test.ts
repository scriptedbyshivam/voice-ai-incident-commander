import { aiProvider } from '../services/ai';

/**
 * These tests exercise the deterministic mock classification path that runs when
 * no real OpenAI key is configured. They validate the CORE RULE behavior of the
 * evidence-aware incident commander:
 *   - hypothesis stays a hypothesis (never becomes a confirmed fact)
 *   - missing evidence is surfaced, not inferred
 *   - conflicting claims produce a POTENTIAL_CONFLICT
 */

describe('AI Evidence-Aware Classification (mock mode)', () => {
  test('Test 1: metric/report statement is classified as REPORTED_OBSERVATION (not confirmed fact)', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'Payment failures are at 42 percent.',
      speakerName: 'Priya',
      speakerRole: 'SUPPORT',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });

    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.facts.length).toBe(0); // no confirmed fact without verification
    const obs = result.observations[0];
    expect(obs.type).toBe('REPORTED_OBSERVATION');
    expect(obs.fact?.status).toBe('REPORTED');
  });

  test('Test 2: causal speculation is classified as HYPOTHESIS, never a confirmed fact', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'I think the latest deployment caused this.',
      speakerName: 'Rahul',
      speakerRole: 'ENGINEER',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });

    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.hypotheses[0].type).toBe('HYPOTHESIS');
    expect(result.hypotheses[0].hypothesis?.status).toBe('UNCONFIRMED');
    expect(result.facts.length).toBe(0);
  });

  test('Test 3: explicit approval/agreement is classified as DECISION', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'Rollback is approved.',
      speakerName: 'Incident Commander',
      speakerRole: 'INCIDENT_COMMANDER',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });

    expect(result.decisions.length).toBeGreaterThan(0);
  });

  test('Test 4: direct task assignment generates an ACTION', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'Rahul, check the deployment logs.',
      speakerName: 'Incident Commander',
      speakerRole: 'INCIDENT_COMMANDER',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0].type).toBe('ACTION');
  });

  test('Test 5: plain latency report is classified as REPORTED_OBSERVATION', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'Database latency is high.',
      speakerName: 'Rahul',
      speakerRole: 'ENGINEER',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });

    expect(result.observations.length).toBeGreaterThan(0);
  });

  test('Test 6: contradictory latency claim yields POTENTIAL_CONFLICT', async () => {
    // Default mock mode treats "latency ... normal" as conflicting with a
    // previously reported high-latency claim.
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'Database metrics look normal.',
      speakerName: 'Amit',
      speakerRole: 'SRE',
      situationContext: 'Rahul reported high database latency.',
      recentEvidence: 'Rahul: Database latency is high.',
      currentState: '',
    });

    expect(result.potentialConflicts.length).toBeGreaterThan(0);
    const conflict = result.potentialConflicts[0];
    expect(conflict.type).toBe('POTENTIAL_CONFLICT');
    expect(conflict.conflict?.claimA).toBeDefined();
    expect(conflict.conflict?.claimB).toBeDefined();
  });

  test('empty/missing transcript yields a safe non-crashing result', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: '',
      speakerName: '',
      speakerRole: '',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result.observations)).toBe(true);
  });
});
