/**
 * Compile-time constants injected by Vite's `define` option (see
 * vite.config.ts).
 *
 * They are declared as possibly undefined because the constants are not
 * replaced in the Jest environment, where `src/config.ts` falls back to its
 * defaults.
 */
declare const __API_BASE_URL__: string | undefined;
declare const __REQUEST_TIMEOUT_MS__: number | undefined;
