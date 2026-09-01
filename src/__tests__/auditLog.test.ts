import { IncidentNotFoundError, UnauthorizedCommanderError } from '../lib/errors';

describe('Custom Error Classes Tests', () => {
  test('should format IncidentNotFoundError message correctly', () => {
    const err = new IncidentNotFoundError('inc-123');
    expect(err.message).toBe('Incident with ID "inc-123" was not found.');
    expect(err.name).toBe('IncidentNotFoundError');
  });

  test('should format UnauthorizedCommanderError message correctly', () => {
    const err = new UnauthorizedCommanderError('RESTART_SERVICE');
    expect(err.message).toBe('Action "RESTART_SERVICE" requires Incident Commander approval.');
    expect(err.name).toBe('UnauthorizedCommanderError');
  });
});
