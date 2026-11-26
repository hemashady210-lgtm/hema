import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import { initI18n, i18n } from '@/i18n';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function values(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  return Object.values(obj as object).flatMap(values);
}

describe('translations', () => {
  it('ar and en have exactly the same keys (TESTING §3 rule 5)', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it('no empty strings', () => {
    expect(values(en).filter((v) => !v.trim())).toEqual([]);
    expect(values(ar).filter((v) => !v.trim())).toEqual([]);
  });

  it('interpolation placeholders match between languages', () => {
    const ph = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    const enKeys = keys(en);
    const get = (obj: unknown, path: string) =>
      path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj);
    for (const k of enKeys) {
      expect(ph(get(ar, k) as string), k).toEqual(ph(get(en, k) as string));
    }
  });

  it('the Arabic copy is actually Arabic (no untranslated English left behind)', () => {
    // Keys whose value is intentionally the same or Latin in both languages.
    const allowed = new Set([
      'language.en',
      'auth.brand.englishMessage',
      'auth.brand.englishReply',
    ]);
    const get = (obj: unknown, path: string) =>
      path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj);
    const untranslated = keys(en).filter(
      (k) => !allowed.has(k) && !/[؀-ۿ]/.test(get(ar, k) as string),
    );
    expect(untranslated).toEqual([]);
  });

  it('plurals resolve in both languages, including Arabic "few"', () => {
    initI18n('en');
    expect(i18n.t('shell.trialDaysLeft', { count: 1 })).toBe('Trial · 1 day left');
    expect(i18n.t('shell.trialDaysLeft', { count: 5 })).toBe('Trial · 5 days left');
    void i18n.changeLanguage('ar');
    expect(i18n.t('shell.trialDaysLeft', { count: 3 })).toBe('تجربة · الأيام المتبقية: 3');
    expect(i18n.t('shell.trialDaysLeft', { count: 11 })).toBe('تجربة · الأيام المتبقية: 11');
    void i18n.changeLanguage('en');
  });
});
