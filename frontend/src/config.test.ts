import { API_BASE_URL, REQUEST_TIMEOUT_MS, cleanConfiguredValue } from './config';

describe('cleanConfiguredValue', () => {
  it('leaves a well formed value alone', () => {
    expect(cleanConfiguredValue('https://api.example.com/api')).toBe(
      'https://api.example.com/api',
    );
  });

  // A byte order mark is what a Windows shell prepends when a value is piped
  // into a command. It reached production once: the URL stopped being absolute,
  // so the browser resolved it against the page's own origin and every request
  // failed with a 405 that pointed nowhere near the cause.
  it('strips a leading byte order mark', () => {
    expect(cleanConfiguredValue('﻿https://api.example.com/api')).toBe(
      'https://api.example.com/api',
    );
  });

  it('strips surrounding whitespace and newlines', () => {
    expect(cleanConfiguredValue('  https://api.example.com/api\n')).toBe(
      'https://api.example.com/api',
    );
  });

  it('strips a byte order mark and whitespace together', () => {
    expect(cleanConfiguredValue('﻿  https://api.example.com/api  \r\n')).toBe(
      'https://api.example.com/api',
    );
  });

  it('collapses a value that is only whitespace to an empty string', () => {
    expect(cleanConfiguredValue('﻿   ')).toBe('');
  });

  // Only a *leading* mark is removed; anything else would be corrupting the
  // value rather than cleaning it.
  it('keeps a mark that is not at the start', () => {
    expect(cleanConfiguredValue('https://api.example.com/﻿api')).toBe(
      'https://api.example.com/﻿api',
    );
  });
});

describe('the resolved configuration', () => {
  // Vite replaces the constants at build time and defines them as globals in
  // development; neither happens under Jest, so the defaults apply here.
  it('falls back to the local API when no base URL was injected', () => {
    expect(API_BASE_URL).toBe('http://localhost:8080/api');
  });

  it('falls back to a positive request timeout', () => {
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('exposes a base URL that is absolute', () => {
    // The guard that matters: a relative base URL sends every request to the
    // page's own origin instead of to the API.
    expect(API_BASE_URL).toMatch(/^https?:\/\//);
  });
});
