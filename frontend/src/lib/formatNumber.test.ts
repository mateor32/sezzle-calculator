import { formatNumber } from './formatNumber';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [5, '5'],
    [-5, '-5'],
    [1024, '1024'],
    [2.5, '2.5'],
    [-0.125, '-0.125'],
  ])('renders %p as %p', (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  it('hides binary floating point artefacts', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE 754 double precision.
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('keeps a sensible number of significant digits for a repeating decimal', () => {
    expect(formatNumber(1 / 3)).toBe('0.333333333333');
  });

  it('renders negative zero as zero', () => {
    expect(formatNumber(-0)).toBe('0');
  });

  it('uses exponential notation for very large magnitudes', () => {
    expect(formatNumber(1.2e21)).toBe('1.2e+21');
  });

  it('uses exponential notation for very small magnitudes', () => {
    expect(formatNumber(1.5e-9)).toBe('1.5e-9');
  });

  it('keeps large integers readable while they fit', () => {
    expect(formatNumber(123456789012)).toBe('123456789012');
  });

  it('never renders trailing padding zeros', () => {
    expect(formatNumber(1.5)).toBe('1.5');
    expect(formatNumber(2.25)).toBe('2.25');
  });

  it('describes non-finite values instead of printing them raw', () => {
    expect(formatNumber(Number.NaN)).toBe('Not a number');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('Infinity');
    expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
  });
});
