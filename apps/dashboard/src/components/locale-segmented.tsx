import type { Locale } from '@ai-crm/shared';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** Arabic / English choice as a segmented control (radio group). Labels are in their own language. */
export function LocaleSegmented({
  value,
  onChange,
  label,
}: {
  value: Locale;
  onChange(v: Locale): void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-10 w-full items-center gap-1 rounded-md bg-surface-2 p-1 ring-1 ring-border"
    >
      {(['ar', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          lang={l}
          onClick={() => onChange(l)}
          className={cn(
            'h-8 flex-1 rounded-sm text-subheadline font-medium text-text-secondary transition-colors duration-(--duration-micro) focus-visible:outline-2 focus-visible:outline-accent',
            value === l && 'bg-elevated text-text-primary shadow-e1',
          )}
        >
          {t(`language.${l}`)}
        </button>
      ))}
    </div>
  );
}
