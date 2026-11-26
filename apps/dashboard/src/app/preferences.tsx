// Language (ar/en, RTL/LTR) and appearance (dark-first). Stored locally for visitors and on
// the profile for signed-in users (AuthProvider syncs them both ways).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Direction } from 'radix-ui';
import { LOCALE_DIRECTION, type Locale } from '@ai-crm/shared';
import { applyDocumentLocale, detectLocale, i18n, initI18n } from '@/i18n';
import { storage } from '@/lib/storage';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface PreferencesValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setLocale(locale: Locale): void;
  setTheme(theme: ThemePreference): void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function isTheme(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyDocumentTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  if (resolved === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  root.style.colorScheme = resolved;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const l = detectLocale();
    initI18n(l);
    return l;
  });
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const t = storage.get('theme');
    return isTheme(t) ? t : 'dark';
  });
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(prefers-color-scheme: light)');
    } catch {
      return;
    }
    const onChange = () => setSystem(mq!.matches ? 'light' : 'dark');
    mq.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? system : theme;
  useEffect(() => applyDocumentTheme(resolvedTheme), [resolvedTheme]);

  const setLocale = useCallback((next: Locale) => {
    storage.set('locale', next);
    void i18n.changeLanguage(next);
    applyDocumentLocale(next);
    setLocaleState(next);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    storage.set('theme', next);
    setThemeState(next);
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({ locale, dir: LOCALE_DIRECTION[locale], theme, resolvedTheme, setLocale, setTheme }),
    [locale, theme, resolvedTheme, setLocale, setTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <Direction.Provider dir={value.dir}>{children}</Direction.Provider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
