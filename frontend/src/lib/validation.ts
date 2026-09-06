import { getOperation } from '../domain/operations';
import type { OperationId } from '../types/calculator';

/**
 * Client-side validation.
 *
 * The API validates every request again and remains the source of truth. These
 * rules exist to give immediate feedback and to avoid a round trip for input
 * that cannot possibly succeed. Only the two domain rules a user hits by
 * accident are duplicated here (division by zero and the square root of a
 * negative number); everything else is left to the server so that the two
 * implementations cannot drift far apart.
 */

export type OperandParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

export const OPERAND_MESSAGES = {
  required: 'Enter a number first.',
  notANumber: 'That is not a valid number.',
  notFinite: 'That number is too large to calculate with.',
} as const;

export const DOMAIN_MESSAGES = {
  divisionByZero: 'Cannot divide by zero.',
  negativeSquareRoot: 'No real square root for a negative number.',
} as const;

/** Parses a raw entry into a finite number. */
export function parseOperand(raw: string): OperandParseResult {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { ok: false, message: OPERAND_MESSAGES.required };
  }

  // Number() is stricter than parseFloat(): it rejects trailing characters such
  // as "12abc" instead of silently reading a valid prefix.
  const value = Number(trimmed);

  if (Number.isNaN(value)) {
    return { ok: false, message: OPERAND_MESSAGES.notANumber };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, message: OPERAND_MESSAGES.notFinite };
  }

  return { ok: true, value };
}

export type CalculationCheck = { ok: true } | { ok: false; message: string };

/**
 * Checks a calculation before it is sent.
 *
 * `b` is ignored for unary operations, so a value left over from a previous
 * calculation can never block one.
 */
export function validateCalculation(
  operation: OperationId,
  a: number,
  b?: number,
): CalculationCheck {
  const { arity } = getOperation(operation);

  if (!Number.isFinite(a)) {
    return { ok: false, message: OPERAND_MESSAGES.notFinite };
  }

  if (operation === 'sqrt' && a < 0) {
    return { ok: false, message: DOMAIN_MESSAGES.negativeSquareRoot };
  }

  if (arity === 2) {
    if (b === undefined) {
      return { ok: false, message: OPERAND_MESSAGES.required };
    }
    if (!Number.isFinite(b)) {
      return { ok: false, message: OPERAND_MESSAGES.notFinite };
    }
    if (operation === 'divide' && b === 0) {
      return { ok: false, message: DOMAIN_MESSAGES.divisionByZero };
    }
  }

  return { ok: true };
}
