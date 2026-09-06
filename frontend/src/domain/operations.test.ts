import { OPERATION_IDS } from '../types/calculator';
import { OPERATIONS, getOperation, isOperationId } from './operations';

describe('the operation catalogue', () => {
  it('holds exactly one descriptor per supported operation', () => {
    expect(OPERATIONS.map((operation) => operation.id)).toEqual([...OPERATION_IDS]);
  });

  it('gives every operation a label and a symbol', () => {
    for (const operation of OPERATIONS) {
      expect(operation.label).not.toHaveLength(0);
      expect(operation.symbol).not.toHaveLength(0);
    }
  });

  // The arity here decides whether the keypad waits for a second operand and
  // whether the request carries a "b", so it has to match the API exactly.
  it.each([
    ['add', 2],
    ['subtract', 2],
    ['multiply', 2],
    ['divide', 2],
    ['power', 2],
    ['sqrt', 1],
    ['percentage', 2],
  ] as const)('records the arity of %s as %i', (id, arity) => {
    expect(getOperation(id).arity).toBe(arity);
  });

  it.each([
    ['add', '+'],
    ['subtract', '−'],
    ['multiply', '×'],
    ['divide', '÷'],
    ['power', '^'],
    ['sqrt', '√'],
    ['percentage', '%'],
  ] as const)('prints %s as %s', (id, symbol) => {
    expect(getOperation(id).symbol).toBe(symbol);
  });

  it.each([
    ['add', '2 + 3'],
    ['subtract', '2 − 3'],
    ['multiply', '2 × 3'],
    ['divide', '2 ÷ 3'],
    ['power', '2 ^ 3'],
    ['sqrt', '√2'],
    // The operand order is reversed on purpose: percentage reads as
    // "b percent of a".
    ['percentage', '3% of 2'],
  ] as const)('renders the expression of %s', (id, expected) => {
    expect(getOperation(id).expression('2', '3')).toBe(expected);
  });
});

describe('isOperationId', () => {
  it.each([...OPERATION_IDS])('accepts %s', (id) => {
    expect(isOperationId(id)).toBe(true);
  });

  it.each(['modulo', '', 'ADD', ' add '])('rejects %p', (value) => {
    expect(isOperationId(value)).toBe(false);
  });

  // A plain `in` check or a truthy property lookup would wrongly accept
  // inherited members of Object.prototype.
  it.each(['toString', 'constructor', 'hasOwnProperty'])(
    'rejects the inherited property %p',
    (value) => {
      expect(isOperationId(value)).toBe(false);
    },
  );
});
