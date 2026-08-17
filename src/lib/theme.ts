export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'diu_cr_theme_preference';

let currentPreference: ThemePreference = 'system';
const listeners = new Set<(theme: ThemePreference) => void>();

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function initTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';

  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
  if (saved && (saved === 'system' || saved === 'light' || saved === 'dark')) {
    currentPreference = saved;
  } else {
    currentPreference = 'system';
  }

  applyTheme(currentPreference);

  // Watch system preference changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    mediaQuery.addEventListener('change', () => {
      if (currentPreference === 'system') {
        applyTheme('system');
      }
    });
  }

  return currentPreference;
}

export function getThemePreference(): ThemePreference {
  return currentPreference;
}

export function setThemePreference(pref: ThemePreference) {
  currentPreference = pref;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {}
  applyTheme(pref);
  listeners.forEach((l) => l(pref));
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const effectiveTheme = pref === 'system' ? getSystemTheme() : pref;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

export function subscribeTheme(listener: (theme: ThemePreference) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
