import { OPERATION_IDS, type OperationId } from '../types/calculator';

/**
 * Everything the UI needs to know about one operation: how to label it, how
 * many operands it takes and how to render it in an expression.
 *
 * Keeping this in a single catalogue means the keypad, the display and the
 * validation rules can never disagree about the arity of an operation.
 */
export interface OperationDescriptor {
  id: OperationId;
  /** Long form, used for accessible names and tooltips. */
  label: string;
  /** The character printed on the key and shown in the expression line. */
  symbol: string;
  arity: 1 | 2;
  /** Renders a human readable expression from two raw operand strings. */
  expression: (a: string, b: string) => string;
}

const DESCRIPTORS: Record<OperationId, OperationDescriptor> = {
  add: {
    id: 'add',
    label: 'Add',
    symbol: '+',
    arity: 2,
    expression: (a, b) => `${a} + ${b}`,
  },
  subtract: {
    id: 'subtract',
    label: 'Subtract',
    symbol: '−',
    arity: 2,
    expression: (a, b) => `${a} − ${b}`,
  },
  multiply: {
    id: 'multiply',
    label: 'Multiply',
    symbol: '×',
    arity: 2,
    expression: (a, b) => `${a} × ${b}`,
  },
  divide: {
    id: 'divide',
    label: 'Divide',
    symbol: '÷',
    arity: 2,
    expression: (a, b) => `${a} ÷ ${b}`,
  },
  power: {
    id: 'power',
    label: 'Raise to the power of',
    symbol: '^',
    arity: 2,
    expression: (a, b) => `${a} ^ ${b}`,
  },
  sqrt: {
    id: 'sqrt',
    label: 'Square root',
    symbol: '√',
    arity: 1,
    expression: (a) => `√${a}`,
  },
  percentage: {
    // The API defines this as "b percent of a"; the label spells that out so
    // the operand order is never a guess.
    id: 'percentage',
    label: 'Percentage, b percent of a',
    symbol: '%',
    arity: 2,
    expression: (a, b) => `${b}% of ${a}`,
  },
};

/** Every operation, in the order declared by the API contract. */
export const OPERATIONS: readonly OperationDescriptor[] = OPERATION_IDS.map(
  (id) => DESCRIPTORS[id],
);

/** Resolves an operation id to its descriptor. */
export function getOperation(id: OperationId): OperationDescriptor {
  return DESCRIPTORS[id];
}

/** Narrows an arbitrary string to a supported operation id. */
export function isOperationId(value: string): value is OperationId {
  return Object.prototype.hasOwnProperty.call(DESCRIPTORS, value);
}
