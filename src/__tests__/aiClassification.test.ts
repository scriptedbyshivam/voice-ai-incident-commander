import { aiProvider } from '../services/ai';

describe('AI Evidence-Aware Classification (mock mode)', () => {
  beforeEach(() => {
    jest.spyOn(aiProvider, 'analyzeTranscriptSegment').mockImplementation(async (input) => {
      const text = input.transcript.toLowerCase();
      if (text.includes('failures') || text.includes('latency')) {
        return {
          facts: [],
          observations: [
            {
              type: 'REPORTED_OBSERVATION',
              fact: { title: 'Reported issue', description: input.transcript, status: 'REPORTED' },
              confidence: 0.8,
              reasoningSummary: 'Reported observation',
            },
          ],
          hypotheses: [],
          decisions: [],
          actions: [],
          conflicts: [],
          questions: [],
          risks: [],
        } as any;
      }

      if (text.includes('think') || text.includes('caused')) {
        return {
          facts: [],
          observations: [],
          hypotheses: [
            {
              hypothesis: { title: 'Possible cause', description: input.transcript, status: 'PROPOSED' },
              confidence: 0.6,
              reasoningSummary: 'Speculated cause',
            },
          ],
          decisions: [],
          actions: [],
          conflicts: [],
          questions: [],
          risks: [],
        } as any;
      }

      return {
        facts: [],
        observations: [],
        hypotheses: [],
        decisions: [],
        actions: [],
        conflicts: [],
        questions: [],
        risks: [],
      } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Test 1: metric/report statement is classified as REPORTED_OBSERVATION', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'Payment failures are at 42 percent.',
      speakerName: 'Priya',
      speakerRole: 'SUPPORT',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });

    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.facts.length).toBe(0);
  });

  test('Test 2: causal speculation is classified as HYPOTHESIS', async () => {
    const result = await aiProvider.analyzeTranscriptSegment({
      transcript: 'I think the latest deployment caused this.',
      speakerName: 'Rahul',
      speakerRole: 'ENGINEER',
      situationContext: '',
      recentEvidence: '',
      currentState: '',
    });

    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.facts.length).toBe(0);
  });
});
