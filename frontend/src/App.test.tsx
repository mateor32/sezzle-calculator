import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { THEMES } from './hooks/useTheme';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('renders the heading and the keypad', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'calc' })).toBeInTheDocument();
    expect(screen.getByTestId('key-equals')).toBeInTheDocument();
    expect(screen.getByTestId('display-value')).toHaveTextContent('0');
  });

  it('lands on the idle state without contacting the API', () => {
    render(<App />);

    // setupTests installs a fetch that throws if it is ever called, so a clean
    // render is itself the assertion that nothing was requested.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('the theme switch', () => {
    it('offers one option per palette', () => {
      render(<App />);

      const options = screen.getAllByRole('radio');
      expect(options).toHaveLength(THEMES.length);
    });

    it('starts on the default palette', () => {
      render(<App />);

      expect(screen.getByRole('radio', { name: 'Theme 3' })).toBeChecked();
      expect(document.documentElement.dataset.theme).toBe('3');
    });

    it('applies the chosen palette to the document', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('radio', { name: 'Theme 1' }));

      expect(document.documentElement.dataset.theme).toBe('1');
      expect(screen.getByRole('radio', { name: 'Theme 1' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Theme 3' })).not.toBeChecked();
    });

    it('remembers the choice for the next visit', async () => {
      const user = userEvent.setup();
      const { unmount } = render(<App />);

      await user.click(screen.getByRole('radio', { name: 'Theme 2' }));
      expect(localStorage.getItem('calc:theme')).toBe('2');

      unmount();
      delete document.documentElement.dataset.theme;
      render(<App />);

      expect(screen.getByRole('radio', { name: 'Theme 2' })).toBeChecked();
    });

    it('falls back to the default when the stored value is not a palette', () => {
      localStorage.setItem('calc:theme', 'chartreuse');
      render(<App />);

      expect(screen.getByRole('radio', { name: 'Theme 3' })).toBeChecked();
    });
  });
});
