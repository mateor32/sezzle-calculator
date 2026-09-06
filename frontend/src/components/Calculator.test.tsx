import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApiError, NetworkError, calculate } from '../api/calculatorClient';
import { DOMAIN_MESSAGES, OPERAND_MESSAGES } from '../lib/validation';
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
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const user = userEvent.setup();
  render(<Calculator />);

  return {
    user,
    operationSelect: () => screen.getByLabelText('Operation'),
    firstOperand: () => screen.getByLabelText(/first number/i),
    secondOperand: () => screen.getByLabelText(/second number/i),
    submit: () => screen.getByRole('button'),
  };
}

describe('Calculator', () => {
  describe('rendering', () => {
    it('starts on addition with both operand fields and no result', () => {
      const ui = setup();

      expect(ui.operationSelect()).toHaveValue('add');
      expect(ui.firstOperand()).toBeInTheDocument();
      expect(ui.secondOperand()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Calculate' })).toBeEnabled();
      expect(screen.getByText(/choose an operation/i)).toBeInTheDocument();
    });

    it('hides the second operand for a unary operation', async () => {
      const ui = setup();

      await ui.user.selectOptions(ui.operationSelect(), 'sqrt');

      expect(screen.queryByLabelText(/second number/i)).not.toBeInTheDocument();
      expect(ui.firstOperand()).toBeInTheDocument();
    });

    it('labels the second operand according to the selected operation', async () => {
      const ui = setup();

      await ui.user.selectOptions(ui.operationSelect(), 'power');
      expect(screen.getByLabelText('Exponent (b)')).toBeInTheDocument();

      await ui.user.selectOptions(ui.operationSelect(), 'percentage');
      expect(screen.getByLabelText('Percentage (b)')).toBeInTheDocument();
    });
  });

  describe('client-side validation', () => {
    it('reports empty operands and never calls the API', async () => {
      const ui = setup();

      await ui.user.click(ui.submit());

      expect(await screen.findAllByText(OPERAND_MESSAGES.required)).toHaveLength(2);
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('reports a value that is not a number', async () => {
      const ui = setup();

      await ui.user.type(ui.firstOperand(), 'abc');
      await ui.user.type(ui.secondOperand(), '3');
      await ui.user.click(ui.submit());

      expect(await screen.findByText(OPERAND_MESSAGES.notANumber)).toBeInTheDocument();
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('catches a division by zero before sending it', async () => {
      const ui = setup();

      await ui.user.selectOptions(ui.operationSelect(), 'divide');
      await ui.user.type(ui.firstOperand(), '10');
      await ui.user.type(ui.secondOperand(), '0');
      await ui.user.click(ui.submit());

      expect(await screen.findByText(DOMAIN_MESSAGES.divisionByZero)).toBeInTheDocument();
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('catches the square root of a negative number before sending it', async () => {
      const ui = setup();

      await ui.user.selectOptions(ui.operationSelect(), 'sqrt');
      await ui.user.type(ui.firstOperand(), '-9');
      await ui.user.click(ui.submit());

      expect(
        await screen.findByText(DOMAIN_MESSAGES.negativeSquareRoot),
      ).toBeInTheDocument();
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('marks the invalid input for assistive technology', async () => {
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '2');
      await ui.user.click(ui.submit());

      await waitFor(() => {
        expect(ui.secondOperand()).toHaveAttribute('aria-invalid', 'true');
      });
      expect(ui.firstOperand()).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('successful calculations', () => {
    it('sends the operands and renders the result with its expression', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 2, b: 3, result: 5 });
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '2');
      await ui.user.type(ui.secondOperand(), '3');
      await ui.user.click(ui.submit());

      expect(await screen.findByText('5')).toBeInTheDocument();
      expect(screen.getByText('2 + 3 =')).toBeInTheDocument();
      expect(calculateMock.mock.calls[0]?.[0]).toEqual({ operation: 'add', a: 2, b: 3 });
    });

    it('sends a single operand for a unary operation', async () => {
      calculateMock.mockResolvedValue({ operation: 'sqrt', a: 9, result: 3 });
      const ui = setup();

      await ui.user.selectOptions(ui.operationSelect(), 'sqrt');
      await ui.user.type(ui.firstOperand(), '9');
      await ui.user.click(ui.submit());

      expect(await screen.findByText('3')).toBeInTheDocument();
      expect(calculateMock.mock.calls[0]?.[0]).toEqual({ operation: 'sqrt', a: 9 });
    });

    it('formats a result that carries floating point noise', async () => {
      calculateMock.mockResolvedValue({
        operation: 'add',
        a: 0.1,
        b: 0.2,
        result: 0.30000000000000004,
      });
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '0.1');
      await ui.user.type(ui.secondOperand(), '0.2');
      await ui.user.click(ui.submit());

      expect(await screen.findByText('0.3')).toBeInTheDocument();
    });

    it('clears a previous result when the operation changes', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 2, b: 3, result: 5 });
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '2');
      await ui.user.type(ui.secondOperand(), '3');
      await ui.user.click(ui.submit());
      expect(await screen.findByText('5')).toBeInTheDocument();

      await ui.user.selectOptions(ui.operationSelect(), 'multiply');

      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.getByText(/choose an operation/i)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows the message returned by the API and blames the right field', async () => {
      calculateMock.mockRejectedValue(
        new ApiError('division by zero is undefined', 'DIVISION_BY_ZERO', 422, 'b'),
      );
      const ui = setup();

      // The client-side rule is bypassed by dividing by a value that only the
      // server can reject, so the API error path is the one under test.
      await ui.user.selectOptions(ui.operationSelect(), 'divide');
      await ui.user.type(ui.firstOperand(), '10');
      await ui.user.type(ui.secondOperand(), '2');
      await ui.user.click(ui.submit());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('division by zero is undefined');
      expect(ui.secondOperand()).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows a network failure in plain language', async () => {
      calculateMock.mockRejectedValue(
        new NetworkError('Could not reach the calculation service.'),
      );
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '2');
      await ui.user.type(ui.secondOperand(), '3');
      await ui.user.click(ui.submit());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not reach the calculation service.',
      );
    });

    it('falls back to a generic message for an unrecognised failure', async () => {
      calculateMock.mockRejectedValue(new Error('boom'));
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '2');
      await ui.user.type(ui.secondOperand(), '3');
      await ui.user.click(ui.submit());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/something went wrong/i);
      // The raw failure must never leak to the user.
      expect(alert).not.toHaveTextContent('boom');
    });

    it('replaces an error with the result of a successful retry', async () => {
      calculateMock.mockRejectedValueOnce(new NetworkError('Could not reach it.'));
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '2');
      await ui.user.type(ui.secondOperand(), '3');
      await ui.user.click(ui.submit());
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      calculateMock.mockResolvedValueOnce({ operation: 'add', a: 2, b: 3, result: 5 });
      await ui.user.click(ui.submit());

      expect(await screen.findByText('5')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('pending state', () => {
    it('locks the form while a calculation is in flight', async () => {
      const { promise, resolve } = deferred<CalculationResponse>();
      calculateMock.mockReturnValue(promise);
      const ui = setup();

      await ui.user.type(ui.firstOperand(), '2');
      await ui.user.type(ui.secondOperand(), '3');
      await ui.user.click(ui.submit());

      expect(screen.getByRole('button', { name: /calculating/i })).toBeDisabled();
      expect(ui.firstOperand()).toBeDisabled();
      expect(ui.operationSelect()).toBeDisabled();

      await act(async () => {
        resolve({ operation: 'add', a: 2, b: 3, result: 5 });
      });

      expect(await screen.findByText('5')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Calculate' })).toBeEnabled();
    });
  });
});
