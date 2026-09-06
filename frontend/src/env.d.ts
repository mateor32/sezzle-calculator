/**
 * Compile-time constant injected by Vite's `define` option (see vite.config.ts).
 *
 * It is declared as possibly undefined because the constant is not replaced in
 * the Jest environment, where `src/config.ts` falls back to a default.
 */
declare const __API_BASE_URL__: string | undefined;
