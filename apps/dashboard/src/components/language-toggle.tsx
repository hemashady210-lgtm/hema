import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { usePreferences } from '@/app/preferences';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

/** One-tap switch between Arabic (RTL) and English (LTR). Label shows the target language. */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { setLocale } = useAuth();
  const next: Locale = locale === 'ar' ? 'en' : 'ar';
  const target = t(`language.${next}`);
  return (
    <Tooltip content={t('palette.switchLanguage', { language: target })} disabled={!compact}>
      <Button
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        onClick={() => setLocale(next)}
        aria-label={t('palette.switchLanguage', { language: target })}
        lang={next}
        data-testid="language-toggle"
      >
        <Languages aria-hidden />
        {compact ? null : <span lang={next}>{target}</span>}
      </Button>
    </Tooltip>
  );
}
