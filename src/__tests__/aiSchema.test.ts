import { AIAnalysisResultSchema } from '../services/ai-schema';

describe('AI Analysis Output Schema Validation', () => {
  test('rejects output missing required per-item fields', () => {
    const bad = {
      facts: [{ type: 'FACT' }], // missing statement, confidence, reasoningSummary
    };
    expect(() => AIAnalysisResultSchema.parse(bad)).toThrow();
  });

  test('rejects an invalid extraction type', () => {
    const bad = {
      facts: [
        {
          type: 'CONFIRMED_TRUTH', // not a valid type
          statement: 'universe is broken',
          confidence: 0.9,
          reasoningSummary: 'invalid type',
        },
      ],
    };
    expect(() => AIAnalysisResultSchema.parse(bad)).toThrow();
  });

  test('rejects confidence out of range', () => {
    const bad = {
      facts: [
        {
          type: 'FACT',
          statement: 'failure rate high',
          confidence: 42,
          reasoningSummary: 'confidence too high',
        },
      ],
    };
    expect(() => AIAnalysisResultSchema.parse(bad)).toThrow();
  });

  test('accepts a valid full extraction with all eight buckets', () => {
    const item = {
      type: 'FACT',
      statement: 'Payment failures are at 42 percent',
      speakerName: 'Rahul',
      speakerRole: 'ENGINEER',
      sourceType: 'HUMAN_SPOKEN',
      confidence: 0.85,
      evidence: 'Payment failures are at 42 percent',
      reasoningSummary: 'Metric reported by engineer.',
    };
    const valid = {
      facts: [item],
      observations: [{ ...item, type: 'REPORTED_OBSERVATION' }],
      hypotheses: [{ ...item, type: 'HYPOTHESIS', hypothesis: { status: 'UNCONFIRMED' } }],
      decisions: [{ ...item, type: 'DECISION' }],
      actions: [{ ...item, type: 'ACTION', action: { assigneeName: 'Rahul', isCritical: false } }],
      questions: [{ ...item, type: 'QUESTION' }],
      risks: [{ ...item, type: 'RISK' }],
      potentialConflicts: [
        {
          ...item,
          type: 'POTENTIAL_CONFLICT',
          conflict: { claimA: 'DB high', claimB: 'DB normal' },
        },
      ],
    };

    const result = AIAnalysisResultSchema.parse(valid);
    expect(result.facts).toHaveLength(1);
    expect(result.potentialConflicts[0].conflict?.claimA).toBe('DB high');
    expect(result.facts).toHaveLength(1);
  });

  test('applies default empty arrays when buckets omitted', () => {
    const result = AIAnalysisResultSchema.parse({ facts: [] });
    expect(result.observations).toEqual([]);
    expect(result.hypotheses).toEqual([]);
  });
});
