export class IncidentNotFoundError extends Error {
  constructor(id: string) {
    super(`Incident with ID "${id}" was not found.`);
    this.name = 'IncidentNotFoundError';
  }
}

export class UnauthorizedCommanderError extends Error {
  constructor(action: string) {
    super(`Action "${action}" requires Incident Commander approval.`);
    this.name = 'UnauthorizedCommanderError';
  }
}

export class InvalidActionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActionStateError';
  }
}
