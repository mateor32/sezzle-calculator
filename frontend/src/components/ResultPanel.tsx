import { formatNumber } from '../lib/formatNumber';

/** A completed calculation, ready to display. */
export interface CalculationOutcome {
  /** The expression that produced the value, for example "10 ÷ 4". */
  expression: string;
  value: number;
}

interface ResultPanelProps {
  outcome: CalculationOutcome | null;
  errorMessage: string | null;
  isLoading: boolean;
}

/**
 * The single place where a result, an error or the idle hint is shown.
 *
 * Errors use `role="alert"` so they are announced as soon as they appear, while
 * a successful result sits in a polite live region: a screen reader reads it
 * once the user stops interacting rather than interrupting them mid-keystroke.
 */
export function ResultPanel({ outcome, errorMessage, isLoading }: ResultPanelProps) {
  if (errorMessage !== null) {
    return (
      <div className="result result--error" role="alert">
        <p className="result__label">Error</p>
        <p className="result__message">{errorMessage}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="result result--pending" aria-live="polite">
        <p className="result__message">Calculating…</p>
      </div>
    );
  }

  if (outcome !== null) {
    return (
      <div className="result result--success" aria-live="polite">
        <p className="result__label">{outcome.expression} =</p>
        <output className="result__value">{formatNumber(outcome.value)}</output>
      </div>
    );
  }

  return (
    <div className="result result--idle">
      <p className="result__message">
        Choose an operation, enter your numbers and select Calculate.
      </p>
    </div>
  );
}
