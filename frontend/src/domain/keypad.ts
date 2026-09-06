import type { OperationId } from '../types/calculator';

/** What pressing a key does. */
export type KeyAction =
  | { kind: 'digit'; digit: string }
  | { kind: 'decimal' }
  | { kind: 'operator'; operation: OperationId }
  | { kind: 'delete' }
  | { kind: 'reset' }
  | { kind: 'equals' };

/** How a key is painted. */
export type KeyVariant = 'key' | 'accent' | 'primary';

export interface KeypadKey {
  id: string;
  /** What is printed on the key. */
  label: string;
  action: KeyAction;
  variant: KeyVariant;
  /** Keys that span two grid columns. */
  wide?: boolean;
  /**
   * Physical keyboard keys that activate this button, matched against
   * KeyboardEvent.key. Kept next to the button so the two can never drift.
   */
  shortcuts: readonly string[];
  /** Overrides the accessible name when the printed label is a symbol. */
  ariaLabel?: string;
}

/**
 * The keypad, in reading order.
 *
 * The layout follows a conventional calculator: digits fill the left three
 * columns, the arithmetic operators run down the right-hand column, and the
 * top row carries the three operations the API supports beyond the four basic
 * ones.
 */
export const KEYPAD_KEYS: readonly KeypadKey[] = [
  // Row 1 — the extended operations, plus delete.
  {
    id: 'sqrt',
    label: '√',
    action: { kind: 'operator', operation: 'sqrt' },
    variant: 'key',
    shortcuts: ['r', 'R'],
    ariaLabel: 'Square root',
  },
  {
    id: 'power',
    label: 'xʸ',
    action: { kind: 'operator', operation: 'power' },
    variant: 'key',
    shortcuts: ['^'],
    ariaLabel: 'Raise to the power of',
  },
  {
    id: 'percentage',
    label: '%',
    action: { kind: 'operator', operation: 'percentage' },
    variant: 'key',
    shortcuts: ['%'],
    ariaLabel: 'Percentage, b percent of a',
  },
  {
    id: 'delete',
    label: 'DEL',
    action: { kind: 'delete' },
    variant: 'accent',
    shortcuts: ['Backspace'],
    ariaLabel: 'Delete the last digit',
  },

  // Row 2
  { id: '7', label: '7', action: { kind: 'digit', digit: '7' }, variant: 'key', shortcuts: ['7'] },
  { id: '8', label: '8', action: { kind: 'digit', digit: '8' }, variant: 'key', shortcuts: ['8'] },
  { id: '9', label: '9', action: { kind: 'digit', digit: '9' }, variant: 'key', shortcuts: ['9'] },
  {
    id: 'divide',
    label: '÷',
    action: { kind: 'operator', operation: 'divide' },
    variant: 'key',
    shortcuts: ['/'],
    ariaLabel: 'Divide',
  },

  // Row 3
  { id: '4', label: '4', action: { kind: 'digit', digit: '4' }, variant: 'key', shortcuts: ['4'] },
  { id: '5', label: '5', action: { kind: 'digit', digit: '5' }, variant: 'key', shortcuts: ['5'] },
  { id: '6', label: '6', action: { kind: 'digit', digit: '6' }, variant: 'key', shortcuts: ['6'] },
  {
    id: 'multiply',
    label: '×',
    action: { kind: 'operator', operation: 'multiply' },
    variant: 'key',
    shortcuts: ['*', 'x', 'X'],
    ariaLabel: 'Multiply',
  },

  // Row 4
  { id: '1', label: '1', action: { kind: 'digit', digit: '1' }, variant: 'key', shortcuts: ['1'] },
  { id: '2', label: '2', action: { kind: 'digit', digit: '2' }, variant: 'key', shortcuts: ['2'] },
  { id: '3', label: '3', action: { kind: 'digit', digit: '3' }, variant: 'key', shortcuts: ['3'] },
  {
    id: 'subtract',
    label: '−',
    action: { kind: 'operator', operation: 'subtract' },
    variant: 'key',
    shortcuts: ['-'],
    ariaLabel: 'Subtract',
  },

  // Row 5 — the zero is wide, in the usual calculator way.
  {
    id: 'decimal',
    label: '.',
    action: { kind: 'decimal' },
    variant: 'key',
    shortcuts: ['.', ','],
    ariaLabel: 'Decimal point',
  },
  {
    id: '0',
    label: '0',
    action: { kind: 'digit', digit: '0' },
    variant: 'key',
    wide: true,
    shortcuts: ['0'],
  },
  {
    id: 'add',
    label: '+',
    action: { kind: 'operator', operation: 'add' },
    variant: 'key',
    shortcuts: ['+'],
    ariaLabel: 'Add',
  },

  // Row 6
  {
    id: 'reset',
    label: 'RESET',
    action: { kind: 'reset' },
    variant: 'accent',
    wide: true,
    shortcuts: ['Escape', 'Delete'],
    ariaLabel: 'Reset the calculator',
  },
  {
    id: 'equals',
    label: '=',
    action: { kind: 'equals' },
    variant: 'primary',
    wide: true,
    shortcuts: ['Enter', '='],
    ariaLabel: 'Equals',
  },
];

/** Resolves a physical keyboard key to the keypad button it activates. */
export function findKeyByShortcut(pressed: string): KeypadKey | undefined {
  return KEYPAD_KEYS.find((key) => key.shortcuts.includes(pressed));
}
