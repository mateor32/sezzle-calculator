import { Calculator } from './components/Calculator';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { useTheme } from './hooks/useTheme';

/**
 * Application shell: the page chrome around the calculator, plus the palette
 * switch. The calculator itself owns no layout, so it can be mounted on its own
 * in tests and reused anywhere else.
 */
export function App() {
  const [theme, setTheme] = useTheme();

  return (
    <div className="min-h-dvh px-6 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-132 flex-col gap-6">
        <header className="flex items-end justify-between">
          <h1 className="text-3xl font-bold text-ink">calc</h1>
          <ThemeSwitcher theme={theme} onChange={setTheme} />
        </header>

        <main>
          <Calculator />
        </main>

        <footer className="text-center text-xs leading-relaxed text-ink-muted">
          <p>Every calculation is performed by the Go API.</p>
          <p>
            Keyboard: digits, <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd>{' '}
            <kbd>^</kbd> <kbd>%</kbd> <kbd>r</kbd>, <kbd>Enter</kbd> to
            evaluate, <kbd>Backspace</kbd> to delete, <kbd>Esc</kbd> to reset.
          </p>
        </footer>
      </div>
    </div>
  );
}
