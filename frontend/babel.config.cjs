/**
 * Babel is only used by Jest: Vite compiles the application with esbuild and
 * `@vitejs/plugin-react` does not read this file.
 *
 * Scoping the presets under `env.test` makes that explicit and guarantees the
 * browser build can never be transpiled down to the local Node version.
 */
module.exports = {
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    },
  },
};
