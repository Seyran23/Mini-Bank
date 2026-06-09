export class AppException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string, id?: string | number) {
    const detail = id !== undefined ? ` with id ${id}` : '';
    super(`${resource}${detail} not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictException extends AppException {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenException extends AppException {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ValidationException extends AppException {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 422);
  }
}

export class ServiceUnavailableException extends AppException {
  constructor(service: string) {
    super(`${service} is unavailable`, 'SERVICE_UNAVAILABLE', 503);
  }
}
