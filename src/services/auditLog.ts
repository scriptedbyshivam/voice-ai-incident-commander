import prisma from '@/lib/db';

export interface AuditEntry {
  incidentId: string;
  action: string;
  actor: string;
  details?: Record<string, any>;
  timestamp: string;
}

export class AuditLogService {
  async logAction(entry: AuditEntry) {
    // Record audit event in timeline for historical tracking
    return prisma.timelineEvent.create({
      data: {
        incidentId: entry.incidentId,
        eventType: 'AUDIT_LOG',
        description: `${entry.actor} performed action: ${entry.action}`,
        source: {
          sourceType: 'MANUAL_CONFIRMATION',
          timestamp: entry.timestamp,
          confidence: 1.0,
          verificationStatus: 'VERIFIED',
        } as any,
        relatedEntity: entry.action,
        confidence: 1.0,
      },
    });
  }

  async getAuditLogs(incidentId: string) {
    return prisma.timelineEvent.findMany({
      where: { incidentId, eventType: 'AUDIT_LOG' },
      orderBy: { timestamp: 'desc' },
    });
  }
}

export const auditLogService = new AuditLogService();
export default auditLogService;
