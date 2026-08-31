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
    participants: [],
    confirmedFacts: [
      {
        id: 'f-1',
        title: 'Payment 504 gateway timeouts',
        description: 'Timeouts spike to 45% on downstream banking partner connection',
        status: 'CONFIRMED',
        evidence: {
          sourceType: 'MONITORING',
          timestamp: new Date().toISOString(),
          confidence: 0.95,
          verificationStatus: 'VERIFIED',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    reportedObservations: [],
    hypotheses: [
      {
        id: 'h-1',
        title: 'Stripe webhook saturation',
        description: 'Stripe webhook processing saturated connection pool',
        status: 'REPORTED',
        evidence: {
          sourceType: 'HUMAN_SPOKEN',
          timestamp: new Date().toISOString(),
          confidence: 0.8,
          verificationStatus: 'UNVERIFIED',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    decisions: [
      {
        id: 'd-1',
        title: 'Scale payment-service pods to 12 replicas',
        description: 'Auto-scale deployed to relieve pool pressure',
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
    ],
    actions: [
      {
        id: 'a-1',
        title: 'Apply Helm patch for payment-service',
        description: 'Increase memory limit and replica count',
        assigneeName: 'Amit Kumar',
        status: 'COMPLETED',
        evidence: {
          sourceType: 'MANUAL_CONFIRMATION',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          verificationStatus: 'VERIFIED',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    conflicts: [],
    openQuestions: [],
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
    latestSummary: 'Payment gateway timeout caused by high concurrency and pool saturation.',
  };

  test('should generate post-mortem report with markdown and metrics', () => {
    const report = postMortemService.generateReport(mockState);

    expect(report.incidentId).toBe('test-incident-uuid');
    expect(report.title).toBe('Payment Gateway Timeout Outage');
    expect(report.severity).toBe('SEV1');
    expect(report.summaryMarkdown).toContain('# Incident Post-Mortem: Payment Gateway Timeout Outage');
    expect(report.summaryMarkdown).toContain('Payment 504 gateway timeouts');
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
