import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyThemeToDocument,
  DEFAULT_APP_THEME,
  normalizeAppTheme,
  persistTheme,
  readStoredTheme,
  setAndApplyTheme,
  THEME_STORAGE_KEY
} from './themeService';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    }
  };
}

function createMockClassList(initialClasses: string[] = []) {
  const set = new Set<string>(initialClasses);
  return {
    contains(token: string) {
      return set.has(token);
    },
    toggle(token: string, force?: boolean) {
      if (force === true) {
        set.add(token);
        return true;
      }
      if (force === false) {
        set.delete(token);
        return false;
      }
      if (set.has(token)) {
        set.delete(token);
        return false;
      }
      set.add(token);
      return true;
    }
  };
}

function createMockDocument() {
  const attrs = new Map<string, string>();
  const metaAttrs = new Map<string, string>([['content', 'dark']]);
  return {
    documentElement: {
      classList: createMockClassList(['dark']),
      style: { colorScheme: 'dark' },
      setAttribute(name: string, val: string) {
        attrs.set(name, val);
      },
      getAttribute(name: string) {
        return attrs.get(name) ?? null;
      }
    },
    body: {
      classList: createMockClassList(['dark'])
    },
    querySelector(selector: string) {
      if (selector === 'meta[name="color-scheme"]') {
        return {
          setAttribute(name: string, val: string) {
            metaAttrs.set(name, val);
          },
          getAttribute(name: string) {
            return metaAttrs.get(name) ?? null;
          }
        };
      }
      return null;
    }
  } as unknown as Document;
}

describe('themeService', () => {
  it('normalizes valid values and falls back to dark default', () => {
    assert.equal(DEFAULT_APP_THEME, 'dark');
    assert.equal(normalizeAppTheme('light'), 'light');
    assert.equal(normalizeAppTheme(' LIGHT '), 'light');
    assert.equal(normalizeAppTheme('dark'), 'dark');
    assert.equal(normalizeAppTheme(''), 'dark');
    assert.equal(normalizeAppTheme(null), 'dark');
    assert.equal(normalizeAppTheme('sepia'), 'dark');
  });

  it('reads and persists theme preference safely in storage', () => {
    const store = createMemoryStorage();
    assert.equal(readStoredTheme(store), 'dark');

    persistTheme('light', store);
    assert.equal(store.getItem(THEME_STORAGE_KEY), 'light');
    assert.equal(readStoredTheme(store), 'light');

    persistTheme('dark', store);
    assert.equal(store.getItem(THEME_STORAGE_KEY), 'dark');
    assert.equal(readStoredTheme(store), 'dark');
  });

  it('toggles html/body classes, data-theme, and color-scheme meta when switching themes', () => {
    const doc = createMockDocument();
    const store = createMemoryStorage();

    setAndApplyTheme('light', doc, store);
    assert.equal(doc.documentElement.classList.contains('dark'), false);
    assert.equal(doc.documentElement.classList.contains('light'), true);
    assert.equal(doc.body.classList.contains('dark'), false);
    assert.equal(doc.body.classList.contains('light'), true);
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
    assert.equal(doc.documentElement.style.colorScheme, 'light');
    assert.equal(doc.querySelector('meta[name="color-scheme"]')?.getAttribute('content'), 'light');
    assert.equal(store.getItem(THEME_STORAGE_KEY), 'light');

    applyThemeToDocument('dark', doc);
    assert.equal(doc.documentElement.classList.contains('dark'), true);
    assert.equal(doc.documentElement.classList.contains('light'), false);
    assert.equal(doc.body.classList.contains('dark'), true);
    assert.equal(doc.body.classList.contains('light'), false);
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
    assert.equal(doc.documentElement.style.colorScheme, 'dark');
    assert.equal(doc.querySelector('meta[name="color-scheme"]')?.getAttribute('content'), 'dark');
  });
});
