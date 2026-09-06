import { useCallback, useEffect, useState } from 'react';

/** The three palettes defined in index.css. */
export const THEMES = ['1', '2', '3'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = '3';

const STORAGE_KEY = 'calc:theme';

export function isTheme(value: unknown): value is Theme {
  return value === '1' || value === '2' || value === '3';
}

/**
 * Reads the theme the inline script in index.html already applied, so the hook
 * agrees with what is on screen instead of overwriting it on mount.
 */
function readInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const applied = document.documentElement.dataset.theme;
    if (isTheme(applied)) {
      return applied;
    }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) {
      return stored;
    }
  } catch {
    // Storage is unavailable in private modes and when cookies are blocked.
  }

  return DEFAULT_THEME;
}

/**
 * Owns the selected palette. The theme lives on the <html> element rather than
 * in React state alone, because every colour token is defined against a
 * [data-theme] selector in CSS.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A theme that cannot be persisted is still applied for this visit.
    }
  }, []);

  return [theme, setTheme];
}
