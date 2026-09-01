import { Severity } from '@/types/incident';

export interface SlaStatus {
  targetResponseMinutes: number;
  elapsedMinutes: number;
  isBreached: boolean;
  minutesRemaining: number;
}

export class SlaMonitorService {
  private getTargetMinutes(severity: Severity): number {
    switch (severity) {
      case 'SEV1':
        return 15; // 15 mins response SLA
      case 'SEV2':
        return 30; // 30 mins response SLA
      case 'SEV3':
        return 120; // 2 hours response SLA
      case 'SEV4':
        return 480; // 8 hours response SLA
      default:
        return 60;
    }
  }

  checkSlaStatus(createdAt: string | Date, severity: Severity): SlaStatus {
    const createdMs = new Date(createdAt).getTime();
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdMs) / 60000));
    const targetResponseMinutes = this.getTargetMinutes(severity);
    const minutesRemaining = targetResponseMinutes - elapsedMinutes;

    return {
      targetResponseMinutes,
      elapsedMinutes,
      isBreached: minutesRemaining < 0,
      minutesRemaining: Math.max(0, minutesRemaining),
    };
  }
}

export const slaMonitorService = new SlaMonitorService();
export default slaMonitorService;
