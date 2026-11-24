export type AppTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'lernwelt_theme';
export const DEFAULT_APP_THEME: AppTheme = 'dark';

export function normalizeAppTheme(raw?: string | null): AppTheme {
  const cleaned = String(raw ?? '').trim().toLowerCase();
  if (cleaned === 'light') return 'light';
  return 'dark';
}

export function readStoredTheme(storage?: Pick<Storage, 'getItem'> | null): AppTheme {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return DEFAULT_APP_THEME;
    const raw = store.getItem(THEME_STORAGE_KEY);
    if (!raw || !raw.trim()) return DEFAULT_APP_THEME;
    return normalizeAppTheme(raw);
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function persistTheme(
  theme: AppTheme,
  storage?: Pick<Storage, 'setItem'> | null
): AppTheme {
  const normalized = normalizeAppTheme(theme);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    store?.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage errors in restricted environments
  }
  return normalized;
}

export function applyThemeToDocument(theme: AppTheme, doc?: Document | null): AppTheme {
  const normalized = normalizeAppTheme(theme);
  const d = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!d) return normalized;

  const root = d.documentElement;
  if (root) {
    root.classList.toggle('dark', normalized === 'dark');
    root.classList.toggle('light', normalized === 'light');
    root.setAttribute('data-theme', normalized);
    if (root.style) {
      root.style.colorScheme = normalized;
    }
  }

  if (d.body) {
    d.body.classList.toggle('dark', normalized === 'dark');
    d.body.classList.toggle('light', normalized === 'light');
  }

  try {
    const colorSchemeMeta = d.querySelector?.('meta[name="color-scheme"]');
    if (colorSchemeMeta) {
      colorSchemeMeta.setAttribute('content', normalized);
    }
  } catch {
    // Ignore querySelector failures on minimal document mocks
  }

  return normalized;
}

export function setAndApplyTheme(
  theme: AppTheme,
  doc?: Document | null,
  storage?: Pick<Storage, 'setItem'> | null
): AppTheme {
  const normalized = persistTheme(theme, storage);
  return applyThemeToDocument(normalized, doc);
}
