import { postMortemService } from '../services/postMortem';
import { calculateIncidentMetrics } from '../lib/metrics';
import { INCIDENT_TEMPLATES, getIncidentTemplate } from '../lib/fixtures';
import { IncidentState } from '../types/incident';

describe('Post-Mortem & Incident Health Metrics Tests', () => {
  const mockState: IncidentState = {
    incidentId: 'test-incident-uuid',
    title: 'Payment Gateway Timeout Outage',
    severity: 'SEV1',
    currentStatus: 'ACTIVE',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    commander: {
      userId: 'user-1',
      name: 'Rahul Sharma',
      role: 'INCIDENT_COMMANDER',
      joinedAt: new Date().toISOString(),
    },
    participants: [],
    facts: [
      {
        id: 'f-1',
        statement: 'Payment 504 gateway timeouts spike to 45%',
        confidence: 0.95,
        evidence: {
          sourceType: 'MONITORING',
          timestamp: new Date().toISOString(),
          confidence: 0.95,
          verificationStatus: 'VERIFIED',
        },
        createdAt: new Date().toISOString(),
      },
    ],
    hypotheses: [
      {
        id: 'h-1',
        statement: 'Stripe webhook processing saturated connection pool',
        status: 'PROPOSED',
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      },
    ],
    decisions: [
      {
        id: 'd-1',
        decision: 'Scale payment-service pods to 12 replicas',
        decisionMaker: 'Rahul Sharma',
        createdAt: new Date().toISOString(),
      },
    ],
    actionItems: [
      {
        id: 'a-1',
        task: 'Apply Helm patch for payment-service',
        assigneeName: 'Amit Kumar',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        statusHistory: [],
      },
    ],
    conflicts: [],
    unresolvedRisks: [],
    timeline: [
      {
        id: 't-1',
        eventType: 'INCIDENT_CREATED',
        description: 'Incident declared by Rahul Sharma',
        eventTime: new Date().toISOString(),
        evidence: {
          sourceType: 'MANUAL_CONFIRMATION',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'VERIFIED',
        },
        createdAt: new Date().toISOString(),
      },
    ],
    latestSummary: {
      summaryText: 'Payment gateway timeout caused by high concurrency and pool saturation.',
      createdAt: new Date().toISOString(),
    },
  };

  test('should generate post-mortem report with markdown and metrics', () => {
    const report = postMortemService.generateReport(mockState);

    expect(report.incidentId).toBe('test-incident-uuid');
    expect(report.title).toBe('Payment Gateway Timeout Outage');
    expect(report.severity).toBe('SEV1');
    expect(report.summaryMarkdown).toContain('# Incident Post-Mortem: Payment Gateway Timeout Outage');
    expect(report.summaryMarkdown).toContain('Payment 504 gateway timeouts spike to 45%');
    expect(report.summaryMarkdown).toContain('Scale payment-service pods to 12 replicas');
    expect(report.metrics.confirmedFactsCount).toBe(1);
    expect(report.metrics.decisionsCount).toBe(1);
    expect(report.metrics.actionItemsCount).toBe(1);
  });

  test('should compute health metrics and SLA scores', () => {
    const metrics = calculateIncidentMetrics(mockState);

    expect(metrics.severityWeight).toBe(100); // SEV1 = 100
    expect(metrics.durationMinutes).toBeGreaterThanOrEqual(25);
    expect(metrics.unresolvedRiskScore).toBe(0);
    expect(metrics.triageVelocityScore).toBeGreaterThanOrEqual(50);
  });

  test('should retrieve predefined incident scenario fixtures', () => {
    expect(INCIDENT_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const template = getIncidentTemplate('payment-gateway-timeout');
    expect(template).toBeDefined();
    expect(template?.severity).toBe('SEV1');
  });
});
