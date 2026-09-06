import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import type {
  ApiErrorResponse,
  CalculationRequest,
  CalculationResponse,
} from '../types/calculator';

/**
 * The only module that knows how to talk to the calculator API.
 *
 * Components never call `fetch` themselves: they call `calculate` and handle
 * two error types. That keeps transport concerns (timeouts, status codes,
 * payload shapes) out of the UI and makes the whole surface testable by mocking
 * a single function.
 */

/** The server answered, but with a failure. Carries the API's error code. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  /** The request field at fault, when the API attributes the error to one. */
  readonly field: string | undefined;

  constructor(message: string, code: string, status: number, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

/** The server could not be reached, or did not answer in time. */
export class NetworkError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export const CLIENT_MESSAGES = {
  timeout: 'The calculation took too long. Please try again.',
  unreachable:
    'Could not reach the calculation service. Check that the API is running and try again.',
  malformedResponse: 'The server returned a response the app could not understand.',
  unexpectedStatus: (status: number) =>
    `The server responded with an unexpected error (HTTP ${status}).`,
} as const;

export interface CalculateOptions {
  /** Lets a caller cancel an in-flight request, for example on unmount. */
  signal?: AbortSignal;
  timeoutMs?: number;
  baseUrl?: string;
}

/**
 * Sends a calculation to the API.
 *
 * Resolves with the calculation result. Rejects with an {@link ApiError} when
 * the server reports a problem, a {@link NetworkError} when it cannot be
 * reached or times out, and with the original `AbortError` when the caller
 * cancelled the request themselves.
 */
export async function calculate(
  request: CalculationRequest,
  options: CalculateOptions = {},
): Promise<CalculationResponse> {
  const {
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
    baseUrl = API_BASE_URL,
  } = options;

  // The timeout is built from an AbortController rather than
  // AbortSignal.timeout() so that it behaves identically in every browser and
  // in the jsdom test environment.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', forwardAbort);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${trimTrailingSlash(baseUrl)}/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (cause) {
    if (timedOut) {
      throw new NetworkError(CLIENT_MESSAGES.timeout, cause);
    }
    // A cancellation asked for by the caller is not a failure to report; it is
    // rethrown untouched so the caller can recognise and ignore it.
    if (signal?.aborted) {
      throw cause;
    }
    throw new NetworkError(CLIENT_MESSAGES.unreachable, cause);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(payload, response.status);
  }
  if (!isCalculationResponse(payload)) {
    throw new ApiError(
      CLIENT_MESSAGES.malformedResponse,
      'MALFORMED_RESPONSE',
      response.status,
    );
  }

  return payload;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Reads a JSON body, tolerating an empty or invalid one. A proxy or a crashed
 * server can return HTML with an error status, and that must not surface as a
 * JSON parse error.
 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function toApiError(payload: unknown, status: number): ApiError {
  if (isApiErrorResponse(payload)) {
    return new ApiError(
      payload.error.message,
      payload.error.code,
      status,
      payload.error.field,
    );
  }
  return new ApiError(
    CLIENT_MESSAGES.unexpectedStatus(status),
    'INTERNAL_ERROR',
    status,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false;
  }
  return (
    typeof value.error.code === 'string' && typeof value.error.message === 'string'
  );
}

function isCalculationResponse(value: unknown): value is CalculationResponse {
  return (
    isRecord(value) &&
    typeof value.operation === 'string' &&
    typeof value.a === 'number' &&
    typeof value.result === 'number' &&
    (value.b === undefined || typeof value.b === 'number')
  );
}
