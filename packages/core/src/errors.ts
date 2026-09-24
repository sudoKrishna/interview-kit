/**
 * A single error type carries a stable machine-readable `code` so the API can
 * return structured errors and the batch runner can record a failure reason.
 */
export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STALE_KIT"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "LLM_ERROR"
  | "LLM_INVALID_JSON"
  | "FETCH_ERROR"
  | "COMPANY_UNREACHABLE"
  | "ROBOTS_DISALLOWED"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE"
  | "PRIVATE_ADDRESS"
  | "INVALID_URL"
  | "DUPLICATE"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  STALE_KIT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  LLM_ERROR: 502,
  LLM_INVALID_JSON: 502,
  FETCH_ERROR: 502,
  COMPANY_UNREACHABLE: 502,
  ROBOTS_DISALLOWED: 403,
  UNSUPPORTED_CONTENT_TYPE: 415,
  RESPONSE_TOO_LARGE: 413,
  PRIVATE_ADDRESS: 400,
  INVALID_URL: 400,
  DUPLICATE: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { details?: unknown; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export interface ErrorPayload {
  error: {
    code: AppErrorCode;
    message: string;
    details?: unknown;
  };
}

export function toErrorPayload(error: unknown): ErrorPayload {
  if (isAppError(error)) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }
  return {
    error: {
      code: "INTERNAL",
      message: error instanceof Error ? error.message : "Unexpected error",
    },
  };
}
