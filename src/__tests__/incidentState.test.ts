import { EvidenceMetadata } from '@/types/incident';
import { factService } from '../services/fact';
import { hypothesisService } from '../services/hypothesis';
import { actionsService } from '../services/actions';
import { conflictService } from '../services/conflict';
import { timelineService } from '../services/timeline';
import { incidentStateAggregationService } from '../services/aggregation';
import { incidentService } from '../services/incident';
import prisma from '../lib/db';

// Mock the Prisma client
jest.mock('../lib/db', () => {
  return {
    __esModule: true,
    default: {
      incident: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      participant: {
        create: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      fact: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      hypothesis: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      actionItem: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      actionStatusHistory: {
        create: jest.fn(),
      },
      conflict: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      timelineEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      openQuestion: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      decision: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };
});

describe('Incident State Persistence Layer Tests', () => {
  const incidentId = 'test-incident-uuid';
  const mockEvidence: EvidenceMetadata = {
    sourceType: 'HUMAN_SPOKEN',
    speakerId: 'user-1',
    sourceText: 'I saw checkout failure rates at 42%',
    timestamp: new Date().toISOString(),
    confidence: 0.8,
    verificationStatus: 'UNVERIFIED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Test Incident Creation
  test('should create incident and initialize state', async () => {
    const mockIncident = { id: incidentId, title: 'Outage 1', severity: 'SEV1', status: 'ACTIVE' };
    (prisma.incident.create as jest.Mock).mockResolvedValue(mockIncident);

    const result = await incidentService.createIncident('Outage 1', 'SEV1', 'outage description');
    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: {
        title: 'Outage 1',
        severity: 'SEV1',
        description: 'outage description',
        status: 'ACTIVE',
      },
    });
    expect(result).toEqual(mockIncident);
  });

  // 2. Test Fact creation and verification
  test('should create a reported fact and block silent confirmation', async () => {
    (prisma.fact.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'fact-1', ...data }));
    (prisma.timelineEvent.create as jest.Mock).mockResolvedValue({});

    // Attempting to create a CONFIRMED fact with unverified evidence should be downgraded to REPORTED
    const fact = await factService.createFact(incidentId, 'Metrics spike', 'Failures spiked', mockEvidence, 'CONFIRMED');

    expect(fact.status).toBe('REPORTED'); // Enforces validation rules
    expect(prisma.fact.create).toHaveBeenCalled();
  });

  test('should confirm fact explicitly through verification', async () => {
    const originalFact = {
      id: 'fact-1',
      incidentId,
      title: 'Metrics spike',
      description: 'Failures spiked',
      status: 'REPORTED',
      evidence: mockEvidence,
    };
    (prisma.fact.findUnique as jest.Mock).mockResolvedValue(originalFact);
    (prisma.fact.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ ...originalFact, ...data }));
    (prisma.timelineEvent.create as jest.Mock).mockResolvedValue({});

    const verifiedFact = await factService.verifyFact('fact-1', 'Incident Commander Rahul', 'Confirmed via Datadog dashboard');

    expect(verifiedFact.status).toBe('CONFIRMED');
    const updatedEvidence = verifiedFact.evidence as unknown as EvidenceMetadata;
    expect(updatedEvidence.verificationStatus).toBe('VERIFIED');
    expect(updatedEvidence.confidence).toBe(1.0);
    expect(prisma.fact.update).toHaveBeenCalled();
  });

  // 3. Test Hypothesis verification and promotion (Hypothesis cannot silently become a fact)
  test('should proposed hypothesis and verify it by promoting to a confirmed fact', async () => {
    const originalHypothesis = {
      id: 'hyp-1',
      incidentId,
      title: 'Release Regression',
      description: 'Recent deploy caused connection pool leak',
      status: 'UNCONFIRMED',
      evidence: mockEvidence,
    };

    (prisma.hypothesis.findUnique as jest.Mock).mockResolvedValue(originalHypothesis);
    (prisma.hypothesis.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ ...originalHypothesis, ...data }));
    (prisma.fact.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'fact-new', ...data }));
    (prisma.timelineEvent.create as jest.Mock).mockResolvedValue({});

    const result = await hypothesisService.verifyHypothesis('hyp-1', 'SRE Amit', 'Deployment was rolled back and metrics recovered');

    // 1. Assert original hypothesis is marked verified (status updated)
    expect(result.hypothesis.status).toBe('CONFIRMED');
    expect((result.hypothesis.evidence as any).verificationStatus).toBe('VERIFIED');

    // 2. Assert a corresponding CONFIRMED Fact was explicitly created
    expect(result.fact.status).toBe('CONFIRMED');
    expect(result.fact.title).toBe(originalHypothesis.title);
    expect(result.fact.description).toBe(originalHypothesis.description);
    expect((result.fact.evidence as any).sourceId).toBe('Hypothesis:hyp-1'); // Correct link/provenance preserved
    expect((result.fact.evidence as any).verificationStatus).toBe('VERIFIED');
  });

  // 4. Test Action lifecycle and status history
  test('should create action and log status changes in ActionStatusHistory', async () => {
    const mockAction = {
      id: 'act-1',
      incidentId,
      title: 'Rollback Deployment',
      description: 'Trigger deploy job rollback',
      status: 'PENDING',
      evidence: mockEvidence,
      assigneeId: null,
    };

    (prisma.actionItem.create as jest.Mock).mockResolvedValue(mockAction);
    (prisma.actionItem.findUnique as jest.Mock).mockResolvedValue(mockAction);
    (prisma.actionItem.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ ...mockAction, ...data }));
    (prisma.actionStatusHistory.create as jest.Mock).mockResolvedValue({});
    (prisma.timelineEvent.create as jest.Mock).mockResolvedValue({});

    // 1. Create
    await actionsService.createAction(incidentId, 'Rollback Deployment', 'Trigger deploy job rollback', mockEvidence);
    expect(prisma.actionStatusHistory.create).toHaveBeenCalledWith({
      data: {
        actionItemId: 'act-1',
        oldStatus: 'PENDING',
        newStatus: 'PENDING',
        changedBy: 'System',
        notes: 'Action item created.',
      },
    });

    // 2. Update Status (Pending -> In Progress)
    await actionsService.updateActionStatus('act-1', 'IN_PROGRESS', 'Rahul', 'Starting script execution');
    expect(prisma.actionStatusHistory.create).toHaveBeenCalledWith({
      data: {
        actionItemId: 'act-1',
        oldStatus: 'PENDING',
        newStatus: 'IN_PROGRESS',
        changedBy: 'Rahul',
        notes: 'Starting script execution',
      },
    });
  });

  // 5. Test Conflict claim preservation
  test('should create conflict and preserve both claims and sources', async () => {
    const sourceA: EvidenceMetadata = {
      sourceType: 'HUMAN_SPOKEN',
      speakerId: 'rahul',
      sourceText: 'DB connection latencies are 800ms+',
      timestamp: new Date().toISOString(),
      confidence: 0.9,
      verificationStatus: 'UNVERIFIED',
    };

    const sourceB: EvidenceMetadata = {
      sourceType: 'MONITORING',
      sourceText: 'Internal DB read charts look flat',
      timestamp: new Date().toISOString(),
      confidence: 1.0,
      verificationStatus: 'VERIFIED',
    };

    (prisma.conflict.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'conf-1', ...data }));
    (prisma.timelineEvent.create as jest.Mock).mockResolvedValue({});

    const conflict = await conflictService.detectAndRecord(
      incidentId,
      'DB Latency metrics discrepancy',
      'Rahul reports connection pool timeouts',
      'Dashboard graphs show flat CPU and IO',
      sourceA,
      sourceB
    );

    expect(conflict.claimA).toBe('Rahul reports connection pool timeouts');
    expect(conflict.claimB).toBe('Dashboard graphs show flat CPU and IO');
    expect(conflict.sourceA).toEqual(sourceA);
    expect(conflict.sourceB).toEqual(sourceB);
    expect(prisma.conflict.create).toHaveBeenCalled();
  });

  // 6. Test Chronological Timeline sorting
  test('should sort timeline chronologically and not by database insertion order', async () => {
    const now = new Date();
    const eventEarlier = { id: 'e-1', timestamp: new Date(now.getTime() - 60000), eventType: 'CREATED', description: 'Early event', source: {} };
    const eventLater = { id: 'e-2', timestamp: now, eventType: 'UPDATED', description: 'Later event', source: {} };

    // DB returns in scrambled order
    const mockDbTimeline = [eventLater, eventEarlier];
    (prisma.timelineEvent.findMany as jest.Mock).mockResolvedValue(mockDbTimeline);

    const timeline = await timelineService.getTimeline(incidentId);

    // Timeline service returns sorted chronologically (Earlier event first)
    expect(timeline[0].id).toBe('e-1');
    expect(timeline[1].id).toBe('e-2');
  });

  // 7. Test Aggregated Incident State retrieval
  test('should return aggregated canonical incident state', async () => {
    const mockIncident = {
      id: incidentId,
      title: 'Payment Outage',
      severity: 'SEV1',
      status: 'ACTIVE',
      createdAt: new Date(),
      participants: [],
      facts: [],
      hypotheses: [],
      decisions: [],
      actions: [],
      conflicts: [],
      questions: [],
      timeline: [],
      summaries: [],
      approvals: [],
    };

    (prisma.incident.findUnique as jest.Mock).mockResolvedValue(mockIncident);

    const state = await incidentStateAggregationService.getIncidentState(incidentId);
    expect(state).toBeDefined();
    expect(state?.incidentId).toBe(incidentId);
    expect(prisma.incident.findUnique).toHaveBeenCalled();
  });
});
