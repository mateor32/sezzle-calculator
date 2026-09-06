/**
 * Formats a result for display.
 *
 * The API returns the full float64 value, which is the correct thing for it to
 * do, but showing `0.30000000000000004` for `0.1 + 0.2` is noise rather than
 * precision. Rounding to twelve significant digits hides the artefacts of
 * binary floating point while keeping every digit a user can reasonably act
 * on, and very large or very small magnitudes fall back to exponential
 * notation instead of a wall of zeros.
 */

/** Below this magnitude a value is shown in exponential notation. */
const SMALL_MAGNITUDE_THRESHOLD = 1e-6;
/** At or above this magnitude a value is shown in exponential notation. */
const LARGE_MAGNITUDE_THRESHOLD = 1e15;
/** Significant digits kept for values shown in plain notation. */
const SIGNIFICANT_DIGITS = 12;
/** Significant digits kept for values shown in exponential notation. */
const EXPONENTIAL_DIGITS = 8;

export function formatNumber(value: number): string {
  if (Number.isNaN(value)) {
    return 'Not a number';
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? 'Infinity' : '-Infinity';
  }
  // Object.is is the only reliable way to spot negative zero, which would
  // otherwise be rendered as "-0".
  if (Object.is(value, -0)) {
    return '0';
  }

  const magnitude = Math.abs(value);

  if (Number.isInteger(value) && magnitude < LARGE_MAGNITUDE_THRESHOLD) {
    return String(value);
  }
  if (magnitude !== 0 && (magnitude >= LARGE_MAGNITUDE_THRESHOLD || magnitude < SMALL_MAGNITUDE_THRESHOLD)) {
    return stripTrailingZeros(value.toExponential(EXPONENTIAL_DIGITS));
  }

  return stripTrailingZeros(value.toPrecision(SIGNIFICANT_DIGITS));
}

/**
 * Removes the padding zeros that `toPrecision` and `toExponential` add, leaving
 * the exponent suffix untouched.
 */
function stripTrailingZeros(text: string): string {
  const exponentIndex = text.indexOf('e');
  const mantissa = exponentIndex === -1 ? text : text.slice(0, exponentIndex);
  const suffix = exponentIndex === -1 ? '' : text.slice(exponentIndex);

  if (!mantissa.includes('.')) {
    return mantissa + suffix;
  }

  return mantissa.replace(/0+$/, '').replace(/\.$/, '') + suffix;
}
