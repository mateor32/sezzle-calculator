/**
 * Runtime configuration of the frontend.
 *
 * `__API_BASE_URL__` is replaced at build time by Vite with the value of the
 * `VITE_API_BASE_URL` environment variable. The `typeof` guard is what makes
 * the module safe outside a Vite build: reading an undeclared identifier throws,
 * but `typeof` on one does not, so the tests get the default without any
 * additional configuration.
 */
const DEFAULT_API_BASE_URL = 'http://localhost:8080/api';

export const API_BASE_URL: string =
  typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__.length > 0
    ? __API_BASE_URL__
    : DEFAULT_API_BASE_URL;

/**
 * How long a calculation may take before the client gives up. The API is a
 * pure computation, so anything slower than this points at a network problem
 * rather than a slow response.
 */
export const REQUEST_TIMEOUT_MS = 8000;
