import { getOperation } from '../domain/operations';
import type { OperationId } from '../types/calculator';

/**
 * The typing state of the keypad.
 *
 * This module is deliberately synchronous and pure: it only knows how digits
 * accumulate into an operand and how the display should read. Everything that
 * needs the network — evaluating a pending operation — is orchestrated by the
 * component, which keeps this logic testable without mocking anything.
 */
export interface KeypadState {
  /**
   * The digits the user is currently typing. An empty string means an operator
   * was just pressed and the second operand has not been started yet.
   */
  entry: string;
  /** The operand committed by the last operator key. */
  operandA: number | null;
  /** The operation waiting for its second operand. */
  operation: OperationId | null;
  /**
   * True immediately after a result was displayed. The next digit starts a new
   * calculation rather than extending the result.
   */
  justEvaluated: boolean;
}

/** Digits a single operand may hold, so the display can never overflow. */
export const MAX_ENTRY_DIGITS = 15;

export const INITIAL_STATE: KeypadState = {
  entry: '0',
  operandA: null,
  operation: null,
  justEvaluated: false,
};

/**
 * Clears the previous result when the user starts typing again, so that
 * pressing a digit after `=` begins a fresh calculation instead of appending
 * to the answer.
 */
function readyForInput(state: KeypadState): KeypadState {
  if (!state.justEvaluated) {
    return state;
  }
  return { entry: '0', operandA: null, operation: null, justEvaluated: false };
}

/** Counts significant characters, ignoring the sign and the decimal point. */
function digitCount(entry: string): number {
  return entry.replace(/[-.]/g, '').length;
}

export function appendDigit(state: KeypadState, digit: string): KeypadState {
  const base = readyForInput(state);

  if (digitCount(base.entry) >= MAX_ENTRY_DIGITS) {
    return base;
  }

  // A leading zero is replaced rather than extended, so "0" then "5" reads 5.
  const entry = base.entry === '' || base.entry === '0' ? digit : base.entry + digit;
  return { ...base, entry };
}

export function appendDecimal(state: KeypadState): KeypadState {
  const base = readyForInput(state);

  if (base.entry.includes('.')) {
    return base;
  }
  return { ...base, entry: base.entry === '' ? '0.' : `${base.entry}.` };
}

export function deleteLast(state: KeypadState): KeypadState {
  if (state.justEvaluated) {
    // Backspacing a result clears it rather than editing its digits.
    return { ...state, entry: '0', justEvaluated: false };
  }
  if (state.entry === '' || state.entry === '0') {
    return state;
  }

  const entry = state.entry.slice(0, -1);
  return { ...state, entry: entry === '' || entry === '-' ? '0' : entry };
}

export function reset(): KeypadState {
  return INITIAL_STATE;
}

/**
 * The number the next operation should use. Falls back to the committed
 * operand so that pressing an operator twice in a row is harmless.
 */
export function currentValue(state: KeypadState): number | null {
  if (state.entry === '') {
    return state.operandA;
  }

  const value = Number(state.entry);
  return Number.isFinite(value) ? value : null;
}

/** The number shown on the main line of the display. */
export function displayEntry(state: KeypadState): string {
  if (state.entry !== '') {
    return state.entry;
  }
  if (state.operandA !== null) {
    return String(state.operandA);
  }
  return '0';
}

/**
 * The secondary line of the display, for example "10 ÷" while the second
 * operand is being typed. Empty when no operation is pending.
 */
export function expressionText(state: KeypadState): string {
  if (state.operation === null || state.operandA === null) {
    return '';
  }

  const { symbol } = getOperation(state.operation);
  const secondOperand = state.entry === '' ? '' : ` ${state.entry}`;

  return `${state.operandA} ${symbol}${secondOperand}`;
}

/** True when `=` has something to compute. */
export function hasPendingOperation(state: KeypadState): boolean {
  return state.operation !== null && state.operandA !== null;
}
