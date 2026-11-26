import { useTranslation } from 'react-i18next';
import { passwordStrength } from '@ai-crm/shared';
import { cn } from '@/lib/utils';

const TONE = ['bg-surface-3', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success'] as const;
const KEY = ['tooShort', 'weak', 'fair', 'good', 'strong'] as const;

/** Four-segment meter; the label is announced politely. Guidance only — the rules are in zod. */
export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const strength = passwordStrength(password);
  return (
    <div className="-mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-(--duration-standard)',
              i <= strength ? TONE[strength] : 'bg-surface-3',
            )}
          />
        ))}
      </div>
      <span className="min-w-16 text-end text-footnote text-text-tertiary">
        <span className="sr-only">{t('auth.password.strength.label')}: </span>
        {password ? t(`auth.password.strength.${KEY[strength]}`) : ''}
      </span>
    </div>
  );
}
