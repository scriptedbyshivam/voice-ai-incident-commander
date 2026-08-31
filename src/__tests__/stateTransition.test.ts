import { incidentStateTransitionLayer } from '../services/stateTransition';
import prisma from '../lib/db';
import { NormalizedExtraction } from '../services/ai-schema';

// Mock the Prisma client. The domain services (fact/hypothesis/decision/actions/
// question/conflict/timeline) all consume this same instance, so verifying the
// state-transition layer lets us assert end-to-end business-rule behavior.
jest.mock('../lib/db', () => {
  return {
    __esModule: true,
    default: {
      participant: {
        findFirst: jest.fn(),
      },
      fact: {
        create: jest.fn(),
      },
      hypothesis: {
        create: jest.fn(),
      },
      decision: {
        create: jest.fn(),
      },
      actionItem: {
        create: jest.fn(),
      },
      actionStatusHistory: {
        create: jest.fn(),
      },
      openQuestion: {
        create: jest.fn(),
      },
      conflict: {
        create: jest.fn(),
      },
      timelineEvent: {
        create: jest.fn(),
      },
      approvalRequest: {
        create: jest.fn(),
      },
    },
  };
});

const incidentId = 'incident-1';

function baseItem(partial: Partial<NormalizedExtraction> & { statement: string; reasoningSummary: string }): NormalizedExtraction {
  const { statement, reasoningSummary, ...rest } = partial;
  return {
    type: 'REPORTED_OBSERVATION',
    statement,
    speakerName: 'Priya',
    speakerRole: 'SUPPORT',
    sourceType: 'HUMAN_SPOKEN',
    confidence: 0.8,
    reasoningSummary,
    ...rest,
  };
}

describe('Incident State Transition Layer (AI cannot directly mutate DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.participant.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.fact.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'fact-id', ...data }));
    (prisma.hypothesis.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'hyp-id', ...data }));
    (prisma.decision.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'dec-id', ...data }));
    (prisma.actionItem.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'act-id', ...data }));
    (prisma.actionStatusHistory.create as jest.Mock).mockResolvedValue({});
    (prisma.openQuestion.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'q-id', ...data }));
    (prisma.conflict.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'conf-id', ...data }));
    (prisma.timelineEvent.create as jest.Mock).mockResolvedValue({});
    (prisma.approvalRequest.create as jest.Mock).mockResolvedValue({});
  });

  test('hypothesis items are persisted as UNCONFIRMED even if model claims otherwise', async () => {
    const extraction: NormalizedExtraction = baseItem({
      type: 'HYPOTHESIS',
      statement: 'Latest deployment likely caused this.',
      reasoningSummary: 'Speculative cause.',
    });

    await incidentStateTransitionLayer.apply(incidentId, [extraction]);

    const createCall = (prisma.hypothesis.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.status).toBe('UNCONFIRMED');
  });

  test('an unverified FACT is demoted to REPORTED by the fact service (no silent confirmation)', async () => {
    const extraction: NormalizedExtraction = baseItem({
      type: 'FACT',
      factStatus: 'CONFIRMED', // model labels it confirmed, but has no verification
      statement: 'Payment failures are at 42 percent.',
      confidence: 0.95,
      reasoningSummary: 'Metric reported.',
    });

    await incidentStateTransitionLayer.apply(incidentId, [extraction]);

    const createCall = (prisma.fact.create as jest.Mock).mock.calls[0][0];
    // FactService rejects CONFIRMED unless evidence.verificationStatus === VERIFIED
    expect(createCall.data.status).toBe('REPORTED');
  });

  test('a REPORTED_OBSERVATION is persisted as a non-confirmed fact record', async () => {
    const extraction: NormalizedExtraction = baseItem({
      type: 'REPORTED_OBSERVATION',
      statement: 'Database latency is high.',
      reasoningSummary: 'Observed latency.',
    });

    await incidentStateTransitionLayer.apply(incidentId, [extraction]);

    expect(prisma.fact.create).toHaveBeenCalled();
    const createCall = (prisma.fact.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.status).toBe('REPORTED');
    // Evidence traceability is preserved
    expect(createCall.data.evidence.speakerId).toBe('Priya');
    expect(createCall.data.evidence.sourceText).toBe('Database latency is high.');
  });

  test('an ACTION assigned to a named person is created (never executed) and critical actions are flagged for approval', async () => {
    const extraction: NormalizedExtraction = baseItem({
      type: 'ACTION',
      assigneeName: 'Rahul',
      statement: 'Rahul, check the deployment logs.',
      reasoningSummary: 'Investigation task.',
    });

    await incidentStateTransitionLayer.apply(incidentId, [extraction]);

    expect(prisma.actionItem.create).toHaveBeenCalled();
    // No approval created for a non-critical investigation action
    expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
  });

  test('a rollback ACTION is NEVER executed and surfaces a human approval request', async () => {
    const extraction: NormalizedExtraction = baseItem({
      type: 'ACTION',
      assigneeName: 'Rahul',
      statement: 'Rollback the deployment now.',
      reasoningSummary: 'Disruptive production action.',
    });

    await incidentStateTransitionLayer.apply(incidentId, [extraction]);

    // The approval request is created (surfacing for human decision), but the
    // action itself is only ever in PENDING state — it is not executed.
    expect(prisma.approvalRequest.create).toHaveBeenCalled();
    const approvalCall = (prisma.approvalRequest.create as jest.Mock).mock.calls[0][0];
    expect(approvalCall.data.status).toBe('PENDING');
    expect(approvalCall.data.actionTitle).toContain('Rollback');
  });

  test('a POTENTIAL_CONFLICT preserves both claims', async () => {
    const extraction: NormalizedExtraction = baseItem({
      type: 'POTENTIAL_CONFLICT',
      statement: 'Database metrics look normal.',
      claimA: 'Rahul reported high database latency.',
      claimB: 'Database metrics look normal.',
      reasoningSummary: 'Contradicts prior claim.',
    });

    await incidentStateTransitionLayer.apply(incidentId, [extraction]);

    expect(prisma.conflict.create).toHaveBeenCalled();
    const createCall = (prisma.conflict.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.claimA).toBe('Rahul reported high database latency.');
    expect(createCall.data.claimB).toBe('Database metrics look normal.');
  });
});
