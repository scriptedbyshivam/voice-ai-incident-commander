import { Severity } from '@/types/incident';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateIncidentInput(title: string, severity: string): ValidationResult {
  const errors: string[] = [];

  if (!title || title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long.');
  }

  if (title && title.length > 150) {
    errors.push('Title cannot exceed 150 characters.');
  }

  const validSeverities: Severity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
  if (!validSeverities.includes(severity as Severity)) {
    errors.push('Invalid severity level. Must be SEV1, SEV2, SEV3, or SEV4.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
