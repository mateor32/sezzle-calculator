import {
  DOMAIN_MESSAGES,
  OPERAND_MESSAGES,
  parseOperand,
  validateForm,
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
    ['a leading plus sign', '+5', 5],
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
    ['negative infinity', '-Infinity', OPERAND_MESSAGES.notFinite],
    ['a magnitude beyond float64', '1e400', OPERAND_MESSAGES.notFinite],
  ])('rejects %s', (_label, input, message) => {
    expect(parseOperand(input)).toEqual({ ok: false, message });
  });
});

describe('validateForm', () => {
  it('accepts two valid operands for a binary operation', () => {
    expect(validateForm('add', '2', '3')).toEqual({
      ok: true,
      operands: { a: 2, b: 3 },
    });
  });

  it('omits the second operand for a unary operation', () => {
    expect(validateForm('sqrt', '9', '')).toEqual({
      ok: true,
      operands: { a: 9 },
    });
  });

  it('ignores leftover text in the second field of a unary operation', () => {
    expect(validateForm('sqrt', '16', 'nonsense')).toEqual({
      ok: true,
      operands: { a: 16 },
    });
  });

  it('reports a missing first operand', () => {
    expect(validateForm('add', '', '3')).toEqual({
      ok: false,
      errors: { a: OPERAND_MESSAGES.required },
    });
  });

  it('reports a missing second operand', () => {
    expect(validateForm('add', '2', '')).toEqual({
      ok: false,
      errors: { b: OPERAND_MESSAGES.required },
    });
  });

  it('reports both operands at once', () => {
    expect(validateForm('multiply', 'x', 'y')).toEqual({
      ok: false,
      errors: {
        a: OPERAND_MESSAGES.notANumber,
        b: OPERAND_MESSAGES.notANumber,
      },
    });
  });

  it('rejects a division by zero without a round trip', () => {
    expect(validateForm('divide', '10', '0')).toEqual({
      ok: false,
      errors: { b: DOMAIN_MESSAGES.divisionByZero },
    });
  });

  it('rejects a division by negative zero', () => {
    expect(validateForm('divide', '10', '-0')).toEqual({
      ok: false,
      errors: { b: DOMAIN_MESSAGES.divisionByZero },
    });
  });

  it('allows a zero dividend', () => {
    expect(validateForm('divide', '0', '5')).toEqual({
      ok: true,
      operands: { a: 0, b: 5 },
    });
  });

  it('rejects the square root of a negative number', () => {
    expect(validateForm('sqrt', '-9', '')).toEqual({
      ok: false,
      errors: { a: DOMAIN_MESSAGES.negativeSquareRoot },
    });
  });

  it('allows the square root of zero', () => {
    expect(validateForm('sqrt', '0', '')).toEqual({
      ok: true,
      operands: { a: 0 },
    });
  });

  it('prefers the parse error over the domain rule when the operand is not a number', () => {
    expect(validateForm('divide', '10', 'zero')).toEqual({
      ok: false,
      errors: { b: OPERAND_MESSAGES.notANumber },
    });
  });

  it.each(['power', 'percentage'] as const)(
    'treats %s as a binary operation',
    (operation) => {
      expect(validateForm(operation, '2', '')).toEqual({
        ok: false,
        errors: { b: OPERAND_MESSAGES.required },
      });
    },
  );

  it('accepts negative operands for operations that allow them', () => {
    expect(validateForm('percentage', '-200', '10')).toEqual({
      ok: true,
      operands: { a: -200, b: 10 },
    });
  });
});
