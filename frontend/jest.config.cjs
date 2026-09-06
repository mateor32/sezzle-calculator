/** @type {import('jest').Config} */
module.exports = {
  // jsdom gives the component tests a DOM to render into.
  testEnvironment: 'jsdom',

  // Registers the jest-dom matchers and resets the fetch mock between tests.
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],

  moduleNameMapper: {
    // Stylesheets carry no behaviour worth asserting on.
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // The entry point only mounts the tree and the type-only modules emit
    // nothing, so neither can be meaningfully covered.
    '!src/main.tsx',
    '!src/setupTests.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageReporters: ['text', 'lcov', 'html'],

  clearMocks: true,
  restoreMocks: true,
};
