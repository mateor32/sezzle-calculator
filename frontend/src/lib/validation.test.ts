import {
  DOMAIN_MESSAGES,
  OPERAND_MESSAGES,
  parseOperand,
  validateCalculation,
} from './validation';

describe('parseOperand', () => {
  it.each([
    ['an integer', '42', 42],
    ['a negative integer', '-42', -42],
    ['a decimal', '3.5', 3.5],
    ['a negative decimal', '-0.125', -0.125],
    ['zero', '0', 0],
    ['exponential notation', '1e3', 1000],
    ['a value padded with spaces', '  7  ', 7],
    ['a trailing decimal point', '12.', 12],
    ['a value without a leading zero', '.5', 0.5],
  ])('accepts %s', (_label, input, expected) => {
    expect(parseOperand(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['an empty value', '', OPERAND_MESSAGES.required],
    ['a value of only spaces', '   ', OPERAND_MESSAGES.required],
    ['letters', 'abc', OPERAND_MESSAGES.notANumber],
    ['a number with a trailing suffix', '12abc', OPERAND_MESSAGES.notANumber],
    ['a comma decimal separator', '1,5', OPERAND_MESSAGES.notANumber],
    ['a lone minus sign', '-', OPERAND_MESSAGES.notANumber],
    ['two decimal points', '1.2.3', OPERAND_MESSAGES.notANumber],
    ['infinity', 'Infinity', OPERAND_MESSAGES.notFinite],
    ['a magnitude beyond float64', '1e400', OPERAND_MESSAGES.notFinite],
  ])('rejects %s', (_label, input, message) => {
    expect(parseOperand(input)).toEqual({ ok: false, message });
  });
});

describe('validateCalculation', () => {
  it.each([
    ['add', 2, 3],
    ['subtract', 2, 3],
    ['multiply', 2, 3],
    ['divide', 10, 4],
    ['power', 2, 10],
    ['percentage', 200, 10],
  ] as const)('accepts a valid %s', (operation, a, b) => {
    expect(validateCalculation(operation, a, b)).toEqual({ ok: true });
  });

  it('accepts a unary operation without a second operand', () => {
    expect(validateCalculation('sqrt', 9)).toEqual({ ok: true });
  });

  it('ignores a leftover second operand on a unary operation', () => {
    expect(validateCalculation('sqrt', 9, 99)).toEqual({ ok: true });
  });

  it('rejects a division by zero', () => {
    expect(validateCalculation('divide', 10, 0)).toEqual({
      ok: false,
      message: DOMAIN_MESSAGES.divisionByZero,
    });
  });

  it('rejects a division by negative zero', () => {
    expect(validateCalculation('divide', 10, -0)).toEqual({
      ok: false,
      message: DOMAIN_MESSAGES.divisionByZero,
    });
  });

  it('allows a zero dividend', () => {
    expect(validateCalculation('divide', 0, 5)).toEqual({ ok: true });
  });

  it('rejects the square root of a negative number', () => {
    expect(validateCalculation('sqrt', -9)).toEqual({
      ok: false,
      message: DOMAIN_MESSAGES.negativeSquareRoot,
    });
  });

  it('allows the square root of zero', () => {
    expect(validateCalculation('sqrt', 0)).toEqual({ ok: true });
  });

  it('reports a missing second operand for a binary operation', () => {
    expect(validateCalculation('add', 2)).toEqual({
      ok: false,
      message: OPERAND_MESSAGES.required,
    });
  });

  it.each([
    ['the first operand', Number.POSITIVE_INFINITY, 1],
    ['the second operand', 1, Number.POSITIVE_INFINITY],
  ])('rejects a non-finite value in %s', (_label, a, b) => {
    expect(validateCalculation('add', a, b)).toEqual({
      ok: false,
      message: OPERAND_MESSAGES.notFinite,
    });
  });

  // Zero is a perfectly good operand everywhere except as a divisor, and a
  // negative one is fine everywhere except under a square root.
  it('allows zero and negative operands for the other operations', () => {
    expect(validateCalculation('add', -5, 0)).toEqual({ ok: true });
    expect(validateCalculation('multiply', 0, -3)).toEqual({ ok: true });
    expect(validateCalculation('percentage', -200, 0)).toEqual({ ok: true });
  });
});
