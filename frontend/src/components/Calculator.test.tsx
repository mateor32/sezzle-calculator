import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';

import { ApiError, NetworkError, calculate } from '../api/calculatorClient';
import { DOMAIN_MESSAGES } from '../lib/validation';
import type { CalculationResponse } from '../types/calculator';
import { Calculator } from './Calculator';

// Only the network call is replaced: the error classes stay real so that
// `instanceof` behaves exactly as it does in the browser.
jest.mock('../api/calculatorClient', () => ({
  ...jest.requireActual('../api/calculatorClient'),
  calculate: jest.fn(),
}));

const calculateMock = jest.mocked(calculate);

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup() {
  const user = userEvent.setup();
  render(<Calculator />);
  return user;
}

/** Presses keypad buttons in sequence, by their key id. */
async function press(user: UserEvent, ...ids: string[]) {
  for (const id of ids) {
    await user.click(screen.getByTestId(`key-${id}`));
  }
}

function displayed(): string {
  return screen.getByTestId('display-value').textContent ?? '';
}

function expression(): string {
  return screen.getByTestId('expression').textContent ?? '';
}

/**
 * Waits for the main display line to settle on a value.
 *
 * Assertions go through the display rather than `findByText`, because every
 * digit also appears as the label of a key and would match twice.
 */
async function expectDisplay(expected: string) {
  await waitFor(() => expect(displayed()).toBe(expected));
}

/** Waits for the secondary expression line to settle. */
async function expectExpression(expected: string) {
  await waitFor(() => expect(expression()).toBe(expected));
}

/** The request body of the nth call to the API. */
function requestAt(index: number) {
  return calculateMock.mock.calls[index]?.[0];
}

describe('Calculator', () => {
  describe('entering numbers', () => {
    it('starts at zero', () => {
      setup();
      expect(displayed()).toBe('0');
    });

    it('accumulates digits', async () => {
      const user = setup();
      await press(user, '1', '2', '3');
      expect(displayed()).toBe('123');
    });

    it('replaces the leading zero', async () => {
      const user = setup();
      await press(user, '7');
      expect(displayed()).toBe('7');
    });

    it('adds a decimal point once', async () => {
      const user = setup();
      await press(user, '1', 'decimal', '5', 'decimal', '2');
      expect(displayed()).toBe('1.52');
    });

    it('groups thousands for readability', async () => {
      const user = setup();
      await press(user, '1', '2', '3', '4', '5', '6', '7');
      expect(displayed()).toBe('1,234,567');
    });

    it('deletes the last digit', async () => {
      const user = setup();
      await press(user, '1', '2', '3', 'delete');
      expect(displayed()).toBe('12');
    });

    it('resets everything', async () => {
      const user = setup();
      await press(user, '9', '9', 'add', '1', 'reset');

      expect(displayed()).toBe('0');
      expect(expression()).toBe('');
    });

    it('never contacts the API while only digits are pressed', async () => {
      const user = setup();
      await press(user, '1', '2', 'decimal', '5', 'delete');
      expect(calculateMock).not.toHaveBeenCalled();
    });
  });

  describe('binary operations', () => {
    it('shows the pending expression once an operator is pressed', async () => {
      const user = setup();
      await press(user, '1', '0', 'divide');

      expect(expression()).toBe('10 ÷');
      // The first operand stays on screen until the second one is typed.
      expect(displayed()).toBe('10');
    });

    it('sends the operands and shows the result', async () => {
      calculateMock.mockResolvedValue({ operation: 'divide', a: 10, b: 4, result: 2.5 });
      const user = setup();

      await press(user, '1', '0', 'divide', '4', 'equals');

      await expectDisplay('2.5');
      expect(requestAt(0)).toEqual({ operation: 'divide', a: 10, b: 4 });
    });

    it.each([
      ['add', { operation: 'add', a: 6, b: 2 }, 8],
      ['subtract', { operation: 'subtract', a: 6, b: 2 }, 4],
      ['multiply', { operation: 'multiply', a: 6, b: 2 }, 12],
      ['power', { operation: 'power', a: 6, b: 2 }, 36],
      ['percentage', { operation: 'percentage', a: 6, b: 2 }, 0.12],
    ] as const)('sends %s with both operands', async (keyId, expected, result) => {
      calculateMock.mockResolvedValue({ ...expected, result });
      const user = setup();

      await press(user, '6', keyId, '2', 'equals');

      await expectDisplay(String(result));
      expect(requestAt(0)).toEqual(expected);
    });

    it('settles a pending operation when a second operator is pressed', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 2, b: 3, result: 5 });
      const user = setup();

      await press(user, '2', 'add', '3', 'add');

      await expectExpression('5 +');
      expect(requestAt(0)).toEqual({ operation: 'add', a: 2, b: 3 });
      expect(displayed()).toBe('5');
    });

    it('starts a new calculation when digits follow a result', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 2, b: 3, result: 5 });
      const user = setup();

      await press(user, '2', 'add', '3', 'equals');
      await expectDisplay('5');

      await press(user, '9');
      expect(displayed()).toBe('9');
      expect(expression()).toBe('');
    });

    it('does nothing when equals is pressed with no pending operation', async () => {
      const user = setup();
      await press(user, '5', 'equals');

      expect(calculateMock).not.toHaveBeenCalled();
      expect(displayed()).toBe('5');
    });
  });

  describe('unary operations', () => {
    it('applies the square root immediately, without a second operand', async () => {
      calculateMock.mockResolvedValue({ operation: 'sqrt', a: 9, result: 3 });
      const user = setup();

      await press(user, '9', 'sqrt');

      await expectDisplay('3');
      expect(requestAt(0)).toEqual({ operation: 'sqrt', a: 9 });
    });
  });

  describe('client-side validation', () => {
    it('refuses to divide by zero without calling the API', async () => {
      const user = setup();

      await press(user, '1', '0', 'divide', '0', 'equals');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        DOMAIN_MESSAGES.divisionByZero,
      );
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('refuses the square root of a negative number without calling the API', async () => {
      calculateMock.mockResolvedValue({ operation: 'subtract', a: 0, b: 9, result: -9 });
      const user = setup();

      // 0 - 9 gives a negative value on screen, which sqrt must then reject.
      await press(user, '0', 'subtract', '9', 'equals');
      await expectDisplay('-9');

      calculateMock.mockClear();
      await press(user, 'sqrt');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        DOMAIN_MESSAGES.negativeSquareRoot,
      );
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('clears the error as soon as the user types again', async () => {
      const user = setup();

      await press(user, '1', 'divide', '0', 'equals');
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await press(user, '5');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows the message returned by the API', async () => {
      calculateMock.mockRejectedValue(
        new ApiError('the result is too large', 'OVERFLOW', 422),
      );
      const user = setup();

      await press(user, '9', 'power', '9', 'equals');

      expect(await screen.findByRole('alert')).toHaveTextContent('the result is too large');
    });

    it('shows a network failure in plain language', async () => {
      calculateMock.mockRejectedValue(new NetworkError('Could not reach the service.'));
      const user = setup();

      await press(user, '2', 'add', '2', 'equals');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not reach the service.',
      );
    });

    it('falls back to a generic message for an unrecognised failure', async () => {
      calculateMock.mockRejectedValue(new Error('boom'));
      const user = setup();

      await press(user, '2', 'add', '2', 'equals');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/something went wrong/i);
      // The raw failure must never leak to the user.
      expect(alert).not.toHaveTextContent('boom');
    });

    it('keeps the typed number on screen when a request fails', async () => {
      calculateMock.mockRejectedValue(new NetworkError('offline'));
      const user = setup();

      await press(user, '2', 'add', '7', 'equals');
      await screen.findByRole('alert');

      expect(displayed()).toBe('7');
    });

    it('replaces an error with the result of a successful retry', async () => {
      calculateMock.mockRejectedValueOnce(new NetworkError('offline'));
      const user = setup();

      await press(user, '2', 'add', '3', 'equals');
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      calculateMock.mockResolvedValueOnce({ operation: 'add', a: 2, b: 3, result: 5 });
      await press(user, 'equals');

      await expectDisplay('5');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('pending state', () => {
    it('reports that a calculation is running', async () => {
      const { promise, resolve } = deferred<CalculationResponse>();
      calculateMock.mockReturnValue(promise);
      const user = setup();

      await press(user, '2', 'add', '3', 'equals');
      expect(expression()).toBe('Calculating…');

      await act(async () => {
        resolve({ operation: 'add', a: 2, b: 3, result: 5 });
      });

      await expectDisplay('5');
    });
  });

  describe('keyboard shortcuts', () => {
    it('types digits and a decimal point', async () => {
      const user = setup();
      await user.keyboard('12.5');
      expect(displayed()).toBe('12.5');
    });

    it.each([
      ['+', 'add'],
      ['-', 'subtract'],
      ['*', 'multiply'],
      ['/', 'divide'],
      ['^', 'power'],
      ['%', 'percentage'],
    ] as const)('maps %s to the %s operation', async (character, operation) => {
      calculateMock.mockResolvedValue({ operation, a: 8, b: 2, result: 1 });
      const user = setup();

      await user.keyboard(`8${character}2`);
      await user.keyboard('{Enter}');

      await expectDisplay('1');
      expect(requestAt(0)).toEqual({ operation, a: 8, b: 2 });
    });

    it('maps Backspace to delete and Escape to reset', async () => {
      const user = setup();

      await user.keyboard('123{Backspace}');
      expect(displayed()).toBe('12');

      await user.keyboard('{Escape}');
      expect(displayed()).toBe('0');
    });

    it('maps r to the square root', async () => {
      calculateMock.mockResolvedValue({ operation: 'sqrt', a: 16, result: 4 });
      const user = setup();

      await user.keyboard('16r');

      await expectDisplay('4');
      expect(requestAt(0)).toEqual({ operation: 'sqrt', a: 16 });
    });

    it('ignores shortcuts combined with a modifier, so browser commands still work', async () => {
      const user = setup();
      await user.keyboard('{Control>}5{/Control}');
      expect(displayed()).toBe('0');
    });

    it('does not run an action twice when Enter activates a focused button', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 1, b: 1, result: 2 });
      const user = setup();

      await press(user, '1', 'add', '1');
      // Clicking leaves the focus on the key, so a subsequent Enter is handled
      // by the browser and must not also reach the window listener.
      screen.getByTestId('key-equals').focus();
      await user.keyboard('{Enter}');

      await expectDisplay('2');
      expect(calculateMock).toHaveBeenCalledTimes(1);
    });
  });
});
