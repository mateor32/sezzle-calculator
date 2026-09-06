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
  required: 'Enter a number.',
  notANumber: 'Enter a valid number, for example 12, -3.5 or 1e3.',
  notFinite: 'This number is too large to calculate with.',
} as const;

export const DOMAIN_MESSAGES = {
  divisionByZero: 'Cannot divide by zero.',
  negativeSquareRoot: 'The square root of a negative number is not a real number.',
} as const;

/** Parses a raw input value into a finite number. */
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

/** Validation errors keyed by the field they belong to. */
export interface FormErrors {
  a?: string;
  b?: string;
}

/** The operands to send, produced only when the form has no errors. */
export interface ValidatedOperands {
  a: number;
  b?: number;
}

export type ValidationResult =
  | { ok: true; operands: ValidatedOperands }
  | { ok: false; errors: FormErrors };

/**
 * Validates the whole form for the selected operation.
 *
 * The second operand is ignored entirely for unary operations, so leftover text
 * in a hidden field can never block a submission.
 */
export function validateForm(
  operation: OperationId,
  rawA: string,
  rawB: string,
): ValidationResult {
  const { arity } = getOperation(operation);
  const errors: FormErrors = {};

  // A value is only captured on the branch where it passed every check, which
  // is what lets the guard at the end tell a valid form from an invalid one.
  let a: number | undefined;
  let b: number | undefined;

  const parsedA = parseOperand(rawA);
  if (!parsedA.ok) {
    errors.a = parsedA.message;
  } else if (operation === 'sqrt' && parsedA.value < 0) {
    errors.a = DOMAIN_MESSAGES.negativeSquareRoot;
  } else {
    a = parsedA.value;
  }

  if (arity === 2) {
    const parsedB = parseOperand(rawB);
    if (!parsedB.ok) {
      errors.b = parsedB.message;
    } else if (operation === 'divide' && parsedB.value === 0) {
      errors.b = DOMAIN_MESSAGES.divisionByZero;
    } else {
      b = parsedB.value;
    }
  }

  if (a === undefined || (arity === 2 && b === undefined)) {
    return { ok: false, errors };
  }

  const operands: ValidatedOperands = { a };
  if (b !== undefined) {
    operands.b = b;
  }

  return { ok: true, operands };
}
