/**
 * The contract shared with the Go API. These types mirror the JSON payloads of
 * `POST /api/calculate` exactly, so a change on either side shows up here
 * first.
 */

/** Every operation the API supports, in the order shown in the UI. */
export const OPERATION_IDS = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'power',
  'sqrt',
  'percentage',
] as const;

export type OperationId = (typeof OPERATION_IDS)[number];

/** Request body of `POST /api/calculate`. `b` is omitted for unary operations. */
export interface CalculationRequest {
  operation: OperationId;
  a: number;
  b?: number;
}

/** Success body of `POST /api/calculate`. */
export interface CalculationResponse {
  operation: string;
  a: number;
  b?: number;
  result: number;
}

/**
 * Machine readable error codes returned by the API. The UI branches on these
 * rather than on the message, which is free to be reworded.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'UNKNOWN_OPERATION'
  | 'DIVISION_BY_ZERO'
  | 'NEGATIVE_SQUARE_ROOT'
  | 'OVERFLOW'
  | 'UNDEFINED_RESULT'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  // Produced by the client itself when a response cannot be understood.
  | 'MALFORMED_RESPONSE';

/** Error body returned by the API for every non-2xx response. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    /** Names the request field at fault, when the failure maps to one. */
    field?: string;
  };
}
