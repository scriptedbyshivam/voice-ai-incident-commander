import { validateIncidentInput } from '../lib/validation';
import { formatDuration, formatReadableTime } from '../lib/timeUtils';

describe('Search and Helper Validation Tests', () => {
  test('should validate incident title and severity correctly', () => {
    const valid = validateIncidentInput('Payment Gateway Outage', 'SEV1');
    expect(valid.valid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    const invalid = validateIncidentInput('A', 'INVALID_SEV');
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  test('should format duration and readable time strings', () => {
    const pastTime = new Date(Date.now() - 75 * 60 * 1000).toISOString();
    const duration = formatDuration(pastTime);
    expect(duration).toBe('1h 15m');

    const formattedTime = formatReadableTime(new Date());
    expect(formattedTime).toBeDefined();
  });
});
