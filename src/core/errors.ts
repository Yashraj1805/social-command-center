/** Base class for errors that should map to a specific HTTP status and a safe,
 * user-facing message (never leak internals -- spec section 30).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class TenantIsolationError extends AppError {
  constructor() {
    super("Requested resource does not belong to this organization", 403, "TENANT_ISOLATION");
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 500, "CONFIGURATION_ERROR");
  }
}

export class UpstreamApiError extends AppError {
  constructor(provider: string, message: string) {
    super(`${provider} request failed: ${message}`, 502, "UPSTREAM_API_ERROR");
  }
}
