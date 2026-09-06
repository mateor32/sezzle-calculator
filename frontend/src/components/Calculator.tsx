import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, NetworkError, calculate } from '../api/calculatorClient';
import { findKeyByShortcut, type KeyAction } from '../domain/keypad';
import { getOperation } from '../domain/operations';
import { formatNumber } from '../lib/formatNumber';
import {
  INITIAL_STATE,
  appendDecimal,
  appendDigit,
  currentValue,
  deleteLast,
  displayEntry,
  expressionText,
  reset,
  type KeypadState,
} from '../lib/keypadState';
import { validateCalculation } from '../lib/validation';
import type { CalculationRequest, OperationId } from '../types/calculator';
import { Display } from './Display';
import { Keypad } from './Keypad';

const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * The calculator.
 *
 * The typing rules live in lib/keypadState as pure functions and every network
 * detail lives in the API client, which leaves this component with one job:
 * decide when a key press means a calculation, and turn its outcome into
 * something on screen.
 */
export function Calculator() {
  const [state, setState] = useState<KeypadState>(INITIAL_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // The async handlers read the latest state through a ref: they are invoked
  // from event listeners that would otherwise close over a stale snapshot.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // A request counter plus the controller of the request in flight: the counter
  // makes a superseded response impossible to render, and the controller lets
  // an abandoned request be cancelled rather than left running.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Sends one calculation. Resolves to the result, or null if it failed. */
  const runCalculation = useCallback(
    async (request: CalculationRequest): Promise<number | null> => {
      setErrorMessage(null);
      setIsBusy(true);

      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await calculate(request, { signal: controller.signal });
        return requestId === requestIdRef.current ? response.result : null;
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          // A newer key press has already taken over; this failure is stale.
          return null;
        }
        if (error instanceof ApiError || error instanceof NetworkError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage(UNEXPECTED_ERROR_MESSAGE);
        }
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setIsBusy(false);
          abortRef.current = null;
        }
      }
    },
    [],
  );

  const pressOperator = useCallback(
    async (current: KeypadState, operation: OperationId) => {
      const value = currentValue(current);
      if (value === null) {
        return;
      }

      // A unary operation applies to what is already on screen, the way the
      // square root key behaves on a physical calculator.
      if (getOperation(operation).arity === 1) {
        const check = validateCalculation(operation, value);
        if (!check.ok) {
          setErrorMessage(check.message);
          return;
        }

        const result = await runCalculation({ operation, a: value });
        if (result !== null) {
          setState({
            entry: formatNumber(result),
            operandA: null,
            operation: null,
            justEvaluated: true,
          });
        }
        return;
      }

      // A binary operator with an operation already pending settles that one
      // first, so a chain such as 2 + 3 × 4 accumulates as the user expects.
      const { operation: pending, operandA } = current;
      if (pending !== null && operandA !== null && current.entry !== '') {
        const check = validateCalculation(pending, operandA, value);
        if (!check.ok) {
          setErrorMessage(check.message);
          return;
        }

        const result = await runCalculation({ operation: pending, a: operandA, b: value });
        if (result !== null) {
          setState({ entry: '', operandA: result, operation, justEvaluated: false });
        }
        return;
      }

      setErrorMessage(null);
      setState({ entry: '', operandA: value, operation, justEvaluated: false });
    },
    [runCalculation],
  );

  const pressEquals = useCallback(
    async (current: KeypadState) => {
      const { operation, operandA } = current;
      if (operation === null || operandA === null) {
        return;
      }

      const b = currentValue(current);
      if (b === null) {
        return;
      }

      const check = validateCalculation(operation, operandA, b);
      if (!check.ok) {
        setErrorMessage(check.message);
        return;
      }

      const result = await runCalculation({ operation, a: operandA, b });
      if (result !== null) {
        setState({
          entry: formatNumber(result),
          operandA: null,
          operation: null,
          justEvaluated: true,
        });
      }
    },
    [runCalculation],
  );

  const handleAction = useCallback(
    async (action: KeyAction) => {
      const current = stateRef.current;

      switch (action.kind) {
        case 'digit':
          setErrorMessage(null);
          setState(appendDigit(current, action.digit));
          return;
        case 'decimal':
          setErrorMessage(null);
          setState(appendDecimal(current));
          return;
        case 'delete':
          setErrorMessage(null);
          setState(deleteLast(current));
          return;
        case 'reset':
          setErrorMessage(null);
          setState(reset());
          return;
        case 'operator':
          await pressOperator(current, action.operation);
          return;
        case 'equals':
          await pressEquals(current);
      }
    },
    [pressOperator, pressEquals],
  );

  // Physical keyboard support. Enter and Space are left alone while a button
  // has focus, because the browser already activates it and handling the event
  // here as well would run the action twice.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;
      const activatesFocusedButton =
        target instanceof HTMLElement &&
        target.tagName === 'BUTTON' &&
        (event.key === 'Enter' || event.key === ' ');
      if (activatesFocusedButton) {
        return;
      }

      const key = findKeyByShortcut(event.key);
      if (key === undefined) {
        return;
      }

      event.preventDefault();
      void handleAction(key.action);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAction]);

  return (
    <div className="flex flex-col gap-6">
      <Display
        value={displayEntry(state)}
        expression={expressionText(state)}
        errorMessage={errorMessage}
        isBusy={isBusy}
      />
      <Keypad onPress={(action) => void handleAction(action)} />
    </div>
  );
}
