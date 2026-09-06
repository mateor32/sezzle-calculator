import { OPERATIONS, isOperationId } from '../domain/operations';
import type { OperationId } from '../types/calculator';

interface OperationSelectorProps {
  id: string;
  value: OperationId;
  onChange: (value: OperationId) => void;
  disabled?: boolean;
}

/**
 * Operation picker.
 *
 * A native `<select>` is used on purpose: it is keyboard accessible and
 * screen-reader friendly out of the box, and on mobile it opens the platform
 * picker, which no custom dropdown matches without a great deal of code.
 */
export function OperationSelector({
  id,
  value,
  onChange,
  disabled = false,
}: OperationSelectorProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        Operation
      </label>
      <select
        id={id}
        className="field__input field__input--select"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          // The value always comes from the options below, so this guard is
          // only here to keep the callback honestly typed.
          if (isOperationId(event.target.value)) {
            onChange(event.target.value);
          }
        }}
      >
        {OPERATIONS.map((operation) => (
          <option key={operation.id} value={operation.id}>
            {operation.label}
          </option>
        ))}
      </select>
    </div>
  );
}
