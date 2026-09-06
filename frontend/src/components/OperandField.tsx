interface OperandFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * A single numeric operand input with its label and validation message.
 *
 * The input is a text field with `inputMode="decimal"` rather than
 * `type="number"`. A number input discards characters it considers invalid
 * before the change event fires, which makes it impossible to tell the user
 * *why* their input was rejected, and it reacts to the mouse wheel by silently
 * changing the value. Keeping the raw string here means validation owns every
 * decision, while mobile keyboards still open on the numeric layout.
 */
export function OperandField({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
  placeholder,
}: OperandFieldProps) {
  const errorId = `${id}-error`;
  const hasError = error !== undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={hasError ? 'field__input field__input--invalid' : 'field__input'}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hasError ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
