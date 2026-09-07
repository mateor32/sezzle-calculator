import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The API base URL is injected as a compile-time constant rather than read from
 * `import.meta.env` at runtime, for two reasons:
 *
 *  - `import.meta` is invalid in the CommonJS modules that Jest runs, so using
 *    it directly would force an extra Babel plugin into the test setup;
 *  - a plain identifier is trivially replaceable, which lets `src/config.ts`
 *    fall back to a default when the constant was never defined (the case in
 *    the test environment).
 *
 * In development Vite exposes it as a global; in a build it is substituted into
 * the source. Both are handled by the `typeof` guard in src/config.ts.
 */
export default defineConfig(({ mode }) => {
  // The empty prefix makes `loadEnv` consider real environment variables too,
  // which is what lets the Docker build pass VITE_API_BASE_URL as a build arg.
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:8080/api';

  // A hosted free tier can take the best part of a minute to wake a sleeping
  // container, so the client timeout is configurable per environment.
  const requestTimeoutMs = Number(env.VITE_REQUEST_TIMEOUT_MS) || 8000;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl),
      __REQUEST_TIMEOUT_MS__: JSON.stringify(requestTimeoutMs),
    },
    server: {
      port: 5173,
      // Listen on every interface so the dev server is reachable from a
      // container or another device on the network.
      host: true,
    },
    preview: {
      port: 4173,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
