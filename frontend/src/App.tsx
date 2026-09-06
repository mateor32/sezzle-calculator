import { Calculator } from './components/Calculator';

/**
 * Application shell: the page chrome around the calculator. Keeping it free of
 * state means the calculator can be mounted on its own in tests and reused
 * anywhere else without dragging the layout along.
 */
export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Calculator</h1>
        <p className="app__subtitle">
          Every calculation is performed by the Go API; this page only collects
          and validates the input.
        </p>
      </header>

      <main className="app__main">
        <Calculator />
      </main>

      <footer className="app__footer">
        <p>Addition, subtraction, multiplication, division, exponentiation, square root and percentage.</p>
      </footer>
    </div>
  );
}
