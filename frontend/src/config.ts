/**
 * Runtime configuration of the frontend.
 *
 * Both values are replaced at build time by Vite with the corresponding
 * `VITE_*` environment variable (see vite.config.ts). The `typeof` guards are
 * what make this module safe outside a Vite build: reading an undeclared
 * identifier throws, but `typeof` on one does not, so the tests get the
 * defaults without any additional configuration.
 */
const DEFAULT_API_BASE_URL = 'http://localhost:8080/api';

/** U+FEFF, written as an escape because the character itself is invisible. */
const BYTE_ORDER_MARK = new RegExp('^\uFEFF');

/**
 * Strips a byte order mark and surrounding whitespace from a configured value.
 *
 * Environment variables routinely pick up either on the way in — a shell that
 * writes UTF-8 with a BOM, a copied value with a trailing newline — and a
 * leading BOM is particularly nasty here: it silently turns an absolute URL
 * into a relative one, so requests go to the page's own origin instead of to
 * the API and fail with a 405 that points nowhere near the real cause.
 */
export function cleanConfiguredValue(value: string): string {
  return value.replace(BYTE_ORDER_MARK, '').trim();
}

export const API_BASE_URL: string = (() => {
  if (typeof __API_BASE_URL__ !== 'string') {
    return DEFAULT_API_BASE_URL;
  }
  const cleaned = cleanConfiguredValue(__API_BASE_URL__);
  return cleaned.length > 0 ? cleaned : DEFAULT_API_BASE_URL;
})();

/**
 * How long a calculation may take before the client gives up.
 *
 * Against a local API anything slower than a few seconds points at a network
 * problem rather than a slow response. It is configurable because a free tier
 * host idles its containers to sleep, and the request that wakes one can take
 * the best part of a minute — see the deployment notes in the README.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export const REQUEST_TIMEOUT_MS: number =
  typeof __REQUEST_TIMEOUT_MS__ === 'number' &&
  Number.isFinite(__REQUEST_TIMEOUT_MS__) &&
  __REQUEST_TIMEOUT_MS__ > 0
    ? __REQUEST_TIMEOUT_MS__
    : DEFAULT_REQUEST_TIMEOUT_MS;
