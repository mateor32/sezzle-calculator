import {
  INITIAL_STATE,
  MAX_ENTRY_DIGITS,
  appendDecimal,
  appendDigit,
  currentValue,
  deleteLast,
  displayEntry,
  expressionText,
  hasPendingOperation,
  reset,
  type KeypadState,
} from './keypadState';

/** Builds a state, defaulting every field that the test does not care about. */
function state(overrides: Partial<KeypadState> = {}): KeypadState {
  return { ...INITIAL_STATE, ...overrides };
}

/** Types a sequence of digits into a fresh keypad. */
function type(digits: string): KeypadState {
  return [...digits].reduce(
    (current, digit) => (digit === '.' ? appendDecimal(current) : appendDigit(current, digit)),
    INITIAL_STATE,
  );
}

describe('appendDigit', () => {
  it('replaces the leading zero rather than extending it', () => {
    expect(appendDigit(INITIAL_STATE, '5').entry).toBe('5');
  });

  it('accumulates digits', () => {
    expect(type('123').entry).toBe('123');
  });

  it('keeps a single zero when zero is pressed first', () => {
    expect(appendDigit(INITIAL_STATE, '0').entry).toBe('0');
  });

  it('allows zeros after another digit', () => {
    expect(type('105').entry).toBe('105');
  });

  it('starts the second operand from empty after an operator', () => {
    expect(appendDigit(state({ entry: '', operandA: 10, operation: 'add' }), '4').entry).toBe('4');
  });

  it('starts a new calculation after a result was shown', () => {
    const after = appendDigit(state({ entry: '42', justEvaluated: true }), '7');

    expect(after).toEqual({
      entry: '7',
      operandA: null,
      operation: null,
      justEvaluated: false,
    });
  });

  it('stops accepting digits at the length limit', () => {
    const full = type('1'.repeat(MAX_ENTRY_DIGITS));
    expect(full.entry).toHaveLength(MAX_ENTRY_DIGITS);

    expect(appendDigit(full, '9').entry).toBe(full.entry);
  });

  it('does not count the decimal point towards the limit', () => {
    const withPoint = type(`${'1'.repeat(MAX_ENTRY_DIGITS - 1)}.`);
    expect(appendDigit(withPoint, '5').entry).toBe(`${'1'.repeat(MAX_ENTRY_DIGITS - 1)}.5`);
  });
});

describe('appendDecimal', () => {
  it('turns a bare zero into a decimal', () => {
    expect(appendDecimal(INITIAL_STATE).entry).toBe('0.');
  });

  it('appends to an existing number', () => {
    expect(type('12.').entry).toBe('12.');
  });

  it('refuses a second decimal point', () => {
    expect(type('1.5.').entry).toBe('1.5');
  });

  it('opens a new decimal entry after an operator', () => {
    expect(appendDecimal(state({ entry: '', operandA: 1, operation: 'add' })).entry).toBe('0.');
  });

  it('starts a new calculation after a result was shown', () => {
    expect(appendDecimal(state({ entry: '42', justEvaluated: true })).entry).toBe('0.');
  });
});

describe('deleteLast', () => {
  it('removes the last character', () => {
    expect(deleteLast(type('123')).entry).toBe('12');
  });

  it('leaves a zero once the last digit is removed', () => {
    expect(deleteLast(type('7')).entry).toBe('0');
  });

  it('does nothing on an entry that is already zero', () => {
    expect(deleteLast(INITIAL_STATE)).toEqual(INITIAL_STATE);
  });

  it('clears a result instead of editing its digits', () => {
    const after = deleteLast(state({ entry: '1024', justEvaluated: true }));

    expect(after.entry).toBe('0');
    expect(after.justEvaluated).toBe(false);
  });

  it('removes a trailing decimal point', () => {
    expect(deleteLast(type('12.')).entry).toBe('12');
  });
});

describe('reset', () => {
  it('returns the keypad to its initial state', () => {
    const dirty = state({ entry: '99', operandA: 5, operation: 'divide', justEvaluated: true });
    expect(reset()).toEqual(INITIAL_STATE);
    expect(reset()).not.toEqual(dirty);
  });
});

describe('currentValue', () => {
  it('reads the entry being typed', () => {
    expect(currentValue(type('12.5'))).toBe(12.5);
  });

  it('falls back to the committed operand while the entry is empty', () => {
    expect(currentValue(state({ entry: '', operandA: 10, operation: 'add' }))).toBe(10);
  });

  it('returns null when there is nothing to work with', () => {
    expect(currentValue(state({ entry: '', operandA: null }))).toBeNull();
  });

  it('treats a trailing decimal point as a whole number', () => {
    expect(currentValue(type('12.'))).toBe(12);
  });
});

describe('displayEntry', () => {
  it('shows the entry being typed', () => {
    expect(displayEntry(type('42'))).toBe('42');
  });

  it('keeps the first operand on screen after an operator is pressed', () => {
    expect(displayEntry(state({ entry: '', operandA: 10, operation: 'add' }))).toBe('10');
  });

  it('shows zero on a fresh keypad', () => {
    expect(displayEntry(INITIAL_STATE)).toBe('0');
  });
});

describe('expressionText', () => {
  it('is empty when nothing is pending', () => {
    expect(expressionText(INITIAL_STATE)).toBe('');
  });

  it('shows the operand and the operator while the second operand is awaited', () => {
    expect(expressionText(state({ entry: '', operandA: 10, operation: 'divide' }))).toBe('10 ÷');
  });

  it('shows the whole expression once the second operand is being typed', () => {
    expect(expressionText(state({ entry: '4', operandA: 10, operation: 'divide' }))).toBe('10 ÷ 4');
  });

  it.each([
    ['add', '2 +'],
    ['subtract', '2 −'],
    ['multiply', '2 ×'],
    ['divide', '2 ÷'],
    ['power', '2 ^'],
    ['percentage', '2 %'],
  ] as const)('renders the symbol for %s', (operation, expected) => {
    expect(expressionText(state({ entry: '', operandA: 2, operation }))).toBe(expected);
  });
});

describe('hasPendingOperation', () => {
  it('is false on a fresh keypad', () => {
    expect(hasPendingOperation(INITIAL_STATE)).toBe(false);
  });

  it('is true once an operator has been pressed', () => {
    expect(hasPendingOperation(state({ entry: '', operandA: 2, operation: 'add' }))).toBe(true);
  });
});
