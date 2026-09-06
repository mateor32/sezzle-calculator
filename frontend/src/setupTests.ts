import '@testing-library/jest-dom';

/**
 * jsdom does not implement fetch, and the tests must never reach the network
 * anyway. Replacing it with a mock in one place means every test starts from
 * the same clean slate and any unstubbed call fails loudly instead of hanging.
 */
beforeEach(() => {
  global.fetch = jest.fn(() => {
    throw new Error(
      'fetch was called without being mocked for this test. Mock it explicitly with jest.mocked(global.fetch).',
    );
  }) as unknown as typeof fetch;
});
