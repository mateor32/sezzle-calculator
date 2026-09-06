import { OPERATION_IDS, type OperationId } from '../types/calculator';

/**
 * Everything the UI needs to know about one operation: how to label it, how
 * many operands it takes and how to preview the expression it will send.
 *
 * Keeping this in a single catalogue means the selector, the operand fields,
 * the validation rules and the result preview can never disagree about the
 * arity of an operation.
 */
export interface OperationDescriptor {
  id: OperationId;
  /** Label shown in the operation selector. */
  label: string;
  /** Operator symbol used when previewing the expression. */
  symbol: string;
  arity: 1 | 2;
  /** Accessible label of the second operand input; unset for unary operations. */
  secondOperandLabel?: string;
  /** Renders a human readable expression from the two raw input values. */
  expression: (a: string, b: string) => string;
}

const DESCRIPTORS: Record<OperationId, OperationDescriptor> = {
  add: {
    id: 'add',
    label: 'Addition (a + b)',
    symbol: '+',
    arity: 2,
    expression: (a, b) => `${a} + ${b}`,
  },
  subtract: {
    id: 'subtract',
    label: 'Subtraction (a − b)',
    symbol: '−',
    arity: 2,
    expression: (a, b) => `${a} − ${b}`,
  },
  multiply: {
    id: 'multiply',
    label: 'Multiplication (a × b)',
    symbol: '×',
    arity: 2,
    expression: (a, b) => `${a} × ${b}`,
  },
  divide: {
    id: 'divide',
    label: 'Division (a ÷ b)',
    symbol: '÷',
    arity: 2,
    expression: (a, b) => `${a} ÷ ${b}`,
  },
  power: {
    id: 'power',
    label: 'Exponentiation (a ^ b)',
    symbol: '^',
    arity: 2,
    secondOperandLabel: 'Exponent (b)',
    expression: (a, b) => `${a} ^ ${b}`,
  },
  sqrt: {
    id: 'sqrt',
    label: 'Square root (√a)',
    symbol: '√',
    arity: 1,
    expression: (a) => `√${a}`,
  },
  percentage: {
    id: 'percentage',
    // The API defines this as "b percent of a"; the label spells that out so
    // the operand order is never a guess.
    label: 'Percentage (b% of a)',
    symbol: '%',
    arity: 2,
    secondOperandLabel: 'Percentage (b)',
    expression: (a, b) => `${b}% of ${a}`,
  },
};

/** Every operation, in display order. */
export const OPERATIONS: readonly OperationDescriptor[] = OPERATION_IDS.map(
  (id) => DESCRIPTORS[id],
);

/** The operation selected when the app first loads. */
export const DEFAULT_OPERATION_ID: OperationId = 'add';

/** Resolves an operation id to its descriptor. */
export function getOperation(id: OperationId): OperationDescriptor {
  return DESCRIPTORS[id];
}

/** Narrows an arbitrary string to a supported operation id. */
export function isOperationId(value: string): value is OperationId {
  return Object.prototype.hasOwnProperty.call(DESCRIPTORS, value);
}
