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

export const API_BASE_URL: string =
  typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__.length > 0
    ? __API_BASE_URL__
    : DEFAULT_API_BASE_URL;

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
