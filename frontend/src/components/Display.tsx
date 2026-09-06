import { groupThousands } from '../lib/formatNumber';

interface DisplayProps {
  /** The number on the main line, as a raw string. */
  value: string;
  /** The pending expression, for example "10 ÷". Empty when there is none. */
  expression: string;
  errorMessage: string | null;
  isBusy: boolean;
}

/**
 * The screen.
 *
 * An error replaces the expression line rather than the number, so the value
 * the user typed stays visible while they read what went wrong. Errors carry
 * `role="alert"` to be announced immediately; the result sits in a polite live
 * region so a screen reader finishes the current utterance first.
 */
export function Display({ value, expression, errorMessage, isBusy }: DisplayProps) {
  return (
    <section
      className="rounded-panel bg-screen px-6 py-7 sm:px-8 sm:py-9"
      aria-label="Calculator display"
    >
      <div className="flex min-h-6 items-center justify-end">
        {errorMessage !== null ? (
          <p role="alert" className="text-right text-sm leading-snug text-danger sm:text-base">
            {errorMessage}
          </p>
        ) : (
          <p className="text-right text-lg text-ink-muted" data-testid="expression">
            {isBusy ? 'Calculating…' : expression}
          </p>
        )}
      </div>

      <output
        data-testid="display-value"
        aria-live="polite"
        className="mt-2 block text-right text-4xl font-bold break-all text-ink sm:text-5xl"
      >
        {groupThousands(value)}
      </output>
    </section>
  );
}
