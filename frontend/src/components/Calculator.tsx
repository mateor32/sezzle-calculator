import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { ApiError, NetworkError, calculate } from '../api/calculatorClient';
import { DEFAULT_OPERATION_ID, getOperation } from '../domain/operations';
import { validateForm, type FormErrors } from '../lib/validation';
import type { CalculationRequest, OperationId } from '../types/calculator';
import { OperandField } from './OperandField';
import { OperationSelector } from './OperationSelector';
import { ResultPanel, type CalculationOutcome } from './ResultPanel';

const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * The calculator form.
 *
 * This is the only stateful component: the inputs, the selector and the result
 * panel are all presentational, and every network detail lives in the API
 * client. What is left here is the orchestration — validate, send, and turn the
 * outcome into something to display.
 */
export function Calculator() {
  const [operation, setOperation] = useState<OperationId>(DEFAULT_OPERATION_ID);
  const [rawA, setRawA] = useState('');
  const [rawB, setRawB] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [outcome, setOutcome] = useState<CalculationOutcome | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fieldIdPrefix = useId();
  const operationId = `${fieldIdPrefix}-operation`;
  const operandAId = `${fieldIdPrefix}-a`;
  const operandBId = `${fieldIdPrefix}-b`;

  // A request counter plus the controller of the request in flight: the counter
  // makes a superseded response impossible to render, and the controller lets
  // an abandoned request be cancelled instead of left running.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const descriptor = getOperation(operation);
  const needsSecondOperand = descriptor.arity === 2;

  const handleOperationChange = (next: OperationId) => {
    setOperation(next);
    // The previous result belongs to the previous operation, so it would be
    // misleading to leave it on screen.
    setOutcome(null);
    setErrorMessage(null);
    setFieldErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validation = validateForm(operation, rawA, rawB);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      setOutcome(null);
      setErrorMessage(null);
      return;
    }

    const { a, b } = validation.operands;

    setFieldErrors({});
    setErrorMessage(null);
    setIsLoading(true);

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const expression = descriptor.expression(String(a), b === undefined ? '' : String(b));

    const request: CalculationRequest = { operation, a };
    if (b !== undefined) {
      request.b = b;
    }

    try {
      const response = await calculate(request, { signal: controller.signal });

      if (requestId !== requestIdRef.current) {
        return;
      }
      setOutcome({ expression, value: response.result });
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        // A newer submission has already taken over; this failure is stale.
        return;
      }

      setOutcome(null);
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        // Attribute the failure to the field the API blamed, so the input
        // itself is highlighted alongside the message.
        if (error.field === 'a') {
          setFieldErrors({ a: error.message });
        } else if (error.field === 'b') {
          setFieldErrors({ b: error.message });
        }
      } else if (error instanceof NetworkError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(UNEXPECTED_ERROR_MESSAGE);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        abortRef.current = null;
      }
    }
  };

  return (
    <section className="calculator">
      <form className="calculator__form" onSubmit={handleSubmit} noValidate>
        <OperationSelector
          id={operationId}
          value={operation}
          onChange={handleOperationChange}
          disabled={isLoading}
        />

        <div className="calculator__operands">
          <OperandField
            id={operandAId}
            label="First number (a)"
            value={rawA}
            onChange={setRawA}
            error={fieldErrors.a}
            disabled={isLoading}
            placeholder="0"
          />

          {needsSecondOperand ? (
            <OperandField
              id={operandBId}
              label={descriptor.secondOperandLabel ?? 'Second number (b)'}
              value={rawB}
              onChange={setRawB}
              error={fieldErrors.b}
              disabled={isLoading}
              placeholder="0"
            />
          ) : null}
        </div>

        <button className="calculator__submit" type="submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? 'Calculating…' : 'Calculate'}
        </button>
      </form>

      <ResultPanel outcome={outcome} errorMessage={errorMessage} isLoading={isLoading} />
    </section>
  );
}
