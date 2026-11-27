import type { Locale } from '@ai-crm/shared';

/** Latin digits by default (profiles.numeral_style = latin, DESIGN_SYSTEM §10.5). */
export function intlLocale(locale: Locale, numerals: 'latin' | 'arabic_indic' = 'latin'): string {
  if (locale === 'ar') return numerals === 'arabic_indic' ? 'ar-u-nu-arab' : 'ar-u-nu-latn';
  return 'en';
}

export function formatDate(
  value: string | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  timeZone?: string,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function daysUntil(value: string | Date, now: Date = new Date()): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86_400_000));
}

export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** All ISO alpha-2 regions the runtime knows, sorted by localized name. */
export function countryOptions(
  locale: Locale,
  priority: readonly string[],
): { code: string; name: string }[] {
  const codes: string[] = [];
  const probe = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      try {
        const name = probe.of(code);
        // Skip unassigned codes and pseudo-regions (e.g. "Unknown Region", EU, UN, ZZ).
        if (name && name !== code && !['EU', 'EZ', 'UN', 'ZZ', 'XA', 'XB', 'QO'].includes(code))
          codes.push(code);
      } catch {
        /* skip */
      }
    }
  }
  const collator = new Intl.Collator(locale);
  const rest = codes
    .filter((c) => !priority.includes(c))
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((x, y) => collator.compare(x.name, y.name));
  return [...priority.map((code) => ({ code, name: countryName(code, locale) })), ...rest];
}

export function timeZoneOptions(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
    .supportedValuesOf;
  const zones = supported ? supported('timeZone') : [];
  const gulf = [
    'Asia/Riyadh',
    'Asia/Dubai',
    'Asia/Kuwait',
    'Asia/Qatar',
    'Asia/Bahrain',
    'Asia/Muscat',
    'Africa/Cairo',
    'Asia/Amman',
  ];
  return [...gulf, ...zones.filter((z) => !gulf.includes(z))];
}

/** Main time zone of each priority country (the picker's default when the device's zone is unknown). */
const COUNTRY_ZONES: Record<string, string> = {
  SA: 'Asia/Riyadh',
  AE: 'Asia/Dubai',
  KW: 'Asia/Kuwait',
  QA: 'Asia/Qatar',
  BH: 'Asia/Bahrain',
  OM: 'Asia/Muscat',
  EG: 'Africa/Cairo',
  JO: 'Asia/Amman',
};

export function countryTimeZone(country: string | null | undefined): string | undefined {
  return country ? COUNTRY_ZONES[country] : undefined;
}

/**
 * Default for the time zone picker: the device's own zone when it is in the list (HIG entering
 * data › "Get information from the system"), otherwise the country's main zone — never empty.
 */
export function defaultTimeZone(country: string, zones: string[] = timeZoneOptions()): string {
  const device = browserTimeZone();
  if (zones.includes(device)) return device;
  return COUNTRY_ZONES[country] ?? 'Asia/Riyadh';
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
  } catch {
    return 'Asia/Riyadh';
  }
}

export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  const chars =
    parts.length > 1
      ? [parts[0]![0], parts[parts.length - 1]![0]]
      : [...(parts[0] ?? '?')].slice(0, 2);
  return chars.join('').toUpperCase();
}
