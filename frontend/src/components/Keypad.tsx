import { KEYPAD_KEYS, type KeyAction, type KeyVariant, type KeypadKey } from '../domain/keypad';

interface KeypadProps {
  onPress: (action: KeyAction) => void;
}

/**
 * Per-variant colours and the raised bottom edge that shrinks on press.
 *
 * The edge colour has to change with the variant, so each entry names its own
 * token. Keeping resting and pressed states in one string means they cannot be
 * updated independently and fall out of step.
 */
const VARIANT_CLASSES: Record<KeyVariant, string> = {
  key: [
    'bg-key text-key-text',
    'shadow-[inset_0_-4px_0_var(--key-edge)]',
    'active:shadow-[inset_0_-1px_0_var(--key-edge)]',
  ].join(' '),
  accent: [
    'bg-accent text-accent-text',
    'shadow-[inset_0_-4px_0_var(--accent-edge)]',
    'active:shadow-[inset_0_-1px_0_var(--accent-edge)]',
  ].join(' '),
  primary: [
    'bg-primary text-primary-text',
    'shadow-[inset_0_-4px_0_var(--primary-edge)]',
    'active:shadow-[inset_0_-1px_0_var(--primary-edge)]',
  ].join(' '),
};

/** Word keys such as DEL and RESET are set smaller than the numerals. */
const TEXT_SIZE: Record<KeyVariant, string> = {
  key: 'text-2xl sm:text-3xl',
  accent: 'text-base sm:text-lg',
  primary: 'text-2xl sm:text-3xl',
};

const BASE_CLASSES = [
  'flex items-center justify-center',
  'rounded-key py-3 sm:py-4',
  'font-bold leading-none',
  'cursor-pointer select-none',
  'transition-[transform,box-shadow,filter] duration-75 ease-out',
  'hover:brightness-110',
  'active:translate-y-0.5',
  'motion-reduce:transition-none motion-reduce:active:translate-y-0',
].join(' ');

function keyClasses(key: KeypadKey): string {
  return [
    BASE_CLASSES,
    VARIANT_CLASSES[key.variant],
    TEXT_SIZE[key.variant],
    key.wide ? 'col-span-2' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The button grid.
 *
 * Keys stay enabled while a calculation is in flight: the requests are short,
 * the component discards superseded responses, and locking the pad for the
 * length of a network timeout would strand the user with no way to press RESET.
 */
export function Keypad({ onPress }: KeypadProps) {
  return (
    <div className="rounded-panel bg-keypad p-5 sm:p-7">
      <div className="grid grid-cols-4 gap-3 sm:gap-5">
        {KEYPAD_KEYS.map((key) => (
          <button
            key={key.id}
            type="button"
            data-testid={`key-${key.id}`}
            className={keyClasses(key)}
            aria-label={key.ariaLabel}
            onClick={() => onPress(key.action)}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
