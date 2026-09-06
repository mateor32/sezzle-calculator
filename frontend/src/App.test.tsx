import { render, screen } from '@testing-library/react';

import { App } from './App';

describe('App', () => {
  it('renders the page heading and the calculator form', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Calculator' })).toBeInTheDocument();
    expect(screen.getByLabelText('Operation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calculate' })).toBeInTheDocument();
  });

  it('lands on the idle state without contacting the API', () => {
    render(<App />);

    expect(screen.getByText(/choose an operation/i)).toBeInTheDocument();
    // setupTests installs a fetch that throws if it is ever called, so a clean
    // render is itself the assertion that nothing was requested.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
