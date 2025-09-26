export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'FORBIDDEN_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  code: ErrorCode
  status: number
  details?: Array<{ field?: string; message: string }>
  constructor(code: ErrorCode, message: string, status: number, details?: Array<{ field?: string; message: string }>) {
    super(message)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
    this.code = code
    this.status = status
    this.details = details ?? []
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input data', details?: Array<{ field?: string; message: string }>) {
    super('VALIDATION_ERROR', message, 400, details)
  }
}
export class DatabaseError extends AppError {
  constructor(message = 'Database error') {
    super('DATABASE_ERROR', message, 500)
  }
}
export class AuthenticationError extends AppError {
  constructor(message = 'Unauthorized') {
    super('AUTHENTICATION_ERROR', message, 401)
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN_ERROR', message, 403)
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404)
  }
}
export class RateLimitedError extends AppError {
  constructor(message = 'Too Many Requests') {
    super('RATE_LIMITED', message, 429)
  }
}

export const toErrorResponse = (err: unknown, exposeDetails: boolean) => {
  const timestamp = new Date().toISOString()
  if (err instanceof AppError) {
    return {
      body: {
        success: false,
        error: err.message,
        timestamp,
      },
      status: err.status,
    }
  }

  // SQLite/Bun error normalization
  const anyErr = err as any
  const isSqlite =
    anyErr &&
    typeof anyErr === 'object' &&
    (String(anyErr.code || '').startsWith('SQLITE_') || String(anyErr.name || '').includes('SQLite'))

  if (isSqlite) {
    const message: string = anyErr.message || 'Database error'
    // Heuristic: constraint violations (NOT NULL, CHECK, CONSTRAINT) -> validation error (400)
    if (/NOT NULL|NOTNULL|CHECK|CONSTRAINT/i.test(message) || String(anyErr.code || '').includes('CONSTRAINT')) {
      return {
        body: {
          success: false,
          error: exposeDetails ? message : 'Invalid input data',
          timestamp,
        },
        status: 400,
      }
    }

    // Other SQLite/database errors -> treat as generic database error (500)
    return {
      body: {
        success: false,
        error: exposeDetails ? message : 'Database error',
        timestamp,
      },
      status: 500,
    }
  }

  // Unexpected error
  const genericMessage = 'Internal Server Error'
  return {
    body: {
      success: false,
      error: exposeDetails ? (anyErr?.message || genericMessage) : genericMessage,
      timestamp,
    },
    status: 500,
  }
}