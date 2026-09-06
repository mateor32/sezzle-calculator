import { THEMES, type Theme } from '../hooks/useTheme';

interface ThemeSwitcherProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

/** Where the thumb sits for each theme, as a Tailwind translate utility. */
const THUMB_OFFSET: Record<Theme, string> = {
  '1': 'translate-x-0',
  '2': 'translate-x-5.5',
  '3': 'translate-x-11',
};

/**
 * The three-position palette switch.
 *
 * It is a real radio group rather than a styled slider: each position is a
 * button with `role="radio"`, so it is reachable by keyboard and announces
 * which palette is active. The travelling thumb is decorative and hidden from
 * assistive technology.
 */
export function ThemeSwitcher({ theme, onChange }: ThemeSwitcherProps) {
  return (
    <div className="flex items-end gap-3 sm:gap-4">
      <span
        id="theme-label"
        className="pb-1 text-xs tracking-[0.15em] text-ink uppercase"
      >
        Theme
      </span>

      <div>
        <div
          aria-hidden="true"
          className="mb-1 grid grid-cols-3 px-2 text-xs text-ink"
        >
          {THEMES.map((value) => (
            <span key={value} className="text-center">
              {value}
            </span>
          ))}
        </div>

        <div
          role="radiogroup"
          aria-labelledby="theme-label"
          className="relative grid h-6 w-19 grid-cols-3 rounded-full bg-screen p-1"
        >
          {THEMES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              aria-label={`Theme ${value}`}
              className="z-10 cursor-pointer rounded-full"
              onClick={() => onChange(value)}
            />
          ))}

          <span
            aria-hidden="true"
            data-testid="theme-thumb"
            className={`pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-primary transition-transform duration-150 ease-out motion-reduce:transition-none ${THUMB_OFFSET[theme]}`}
          />
        </div>
      </div>
    </div>
  );
}
