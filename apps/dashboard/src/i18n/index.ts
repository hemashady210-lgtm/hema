import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALES, LOCALE_DIRECTION, type Locale } from '@ai-crm/shared';
import { storage } from '@/lib/storage';
import { ar } from './ar';
import { en } from './en';

export const resources = { en: { translation: en }, ar: { translation: ar } } as const;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Stored choice → browser language → product default (ar). */
export function detectLocale(): Locale {
  const stored = storage.get('locale');
  if (isLocale(stored)) return stored;
  if (typeof navigator !== 'undefined') {
    for (const lang of navigator.languages ?? [navigator.language]) {
      const short = lang?.slice(0, 2).toLowerCase();
      if (isLocale(short)) return short;
    }
  }
  return DEFAULT_LOCALE;
}

export function applyDocumentLocale(locale: Locale): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = LOCALE_DIRECTION[locale];
}

let initialized = false;

export function initI18n(locale: Locale = detectLocale()): typeof i18n {
  if (!initialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
      initAsync: false,
    });
    initialized = true;
  } else if (i18n.language !== locale) {
    void i18n.changeLanguage(locale);
  }
  applyDocumentLocale(locale);
  return i18n;
}

export { i18n };
