import { IncidentState, Severity } from '@/types/incident';

export interface IncidentTemplate {
  id: string;
  name: string;
  severity: Severity;
  title: string;
  description: string;
  initialFacts: string[];
  initialHypotheses: string[];
  initialActions: { title: string; assignee: string }[];
}

export const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  {
    id: 'payment-gateway-timeout',
    name: 'Payment Gateway Timeout Outage',
    severity: 'SEV1',
    title: 'Payment Gateway Timeout & 504 Gateway Spike',
    description: 'Checkout conversion dropped by 64% due to downstream banking partner connection timeouts.',
    initialFacts: [
      'Stripe/Adyen payment webhook processing latency exceeded 8,500ms.',
      'Database connection pool on payment-service is saturated at 100% capacity.',
      'No errors reported on user authentication or catalog browsing services.'
    ],
    initialHypotheses: [
      'Connection pool exhaustion caused by blocking synchronous third-party API calls.',
      'Database deadlocks occurring on payment_intents table during high concurrency.'
    ],
    initialActions: [
      { title: 'Scale payment-service pods from 4 to 12', assignee: 'Rahul Sharma' },
      { title: 'Enable circuit breaker on downstream bank endpoints', assignee: 'Amit Kumar' }
    ]
  },
  {
    id: 'database-read-replica-lag',
    name: 'PostgreSQL Read Replica Replication Lag',
    severity: 'SEV2',
    title: 'Primary-Replica Replication Lag Exceeding 120s',
    description: 'Analytics queries and read-heavy endpoints serving stale data due to WAL streaming delays.',
    initialFacts: [
      'WAL replication lag reached 124 seconds on us-east-1 replica.',
      'Long-running aggregation query running on replica for 42 minutes.',
      'Disk IOPS utilization on primary DB at 94%.'
    ],
    initialHypotheses: [
      'Unindexed bulk update job holding exclusive locks preventing WAL apply.',
      'Network saturation between primary and cross-AZ replica instance.'
    ],
    initialActions: [
      { title: 'Terminate long-running query PID 49120 on replica', assignee: 'Priya Patel' },
      { title: 'Temporarily route read traffic back to primary', assignee: 'Amit Kumar' }
    ]
  },
  {
    id: 'k8s-ingress-tls-expiry',
    name: 'Ingress Certificate Expiration Warning',
    severity: 'SEV3',
    title: 'Wildcard SSL Certificate Renewal Failure',
    description: 'Let\'s Encrypt cert-manager automated challenge failing due to DNS propagation timeout.',
    initialFacts: [
      'Current TLS certificate expires in 18 hours.',
      'cert-manager ACME DNS01 challenge timed out on Cloudflare provider.',
      'No customer-facing outages currently active.'
    ],
    initialHypotheses: [
      'Cloudflare API token expired or permissions modified.',
      'Rate-limiting on Let\'s Encrypt staging/production ACME endpoint.'
    ],
    initialActions: [
      { title: 'Rotate Cloudflare DNS API secret in Kubernetes cert-manager namespace', assignee: 'Rahul Sharma' },
      { title: 'Trigger manual certificate renewal via cert-manager CLI', assignee: 'Priya Patel' }
    ]
  }
];

export function getIncidentTemplate(templateId: string): IncidentTemplate | undefined {
  return INCIDENT_TEMPLATES.find((t) => t.id === templateId);
}
