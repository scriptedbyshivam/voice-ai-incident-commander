import { slaMonitorService } from '../services/slaMonitor';

describe('SLA Monitor Service Tests', () => {
  test('should calculate correct SLA target minutes for SEV1', () => {
    const status = slaMonitorService.checkSlaStatus(new Date().toISOString(), 'SEV1');
    expect(status.targetResponseMinutes).toBe(15);
    expect(status.isBreached).toBe(false);
  });

  test('should mark SLA as breached when elapsed time exceeds deadline', () => {
    const pastDate = new Date(Date.now() - 40 * 60 * 1000).toISOString(); // 40 mins ago
    const status = slaMonitorService.checkSlaStatus(pastDate, 'SEV1'); // 15 mins target
    expect(status.isBreached).toBe(true);
    expect(status.minutesRemaining).toBe(0);
  });
});
