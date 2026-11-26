import { useTranslation } from 'react-i18next';
import { BrandMark } from './brand-mark';

export function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div
      className="grid min-h-dvh place-items-center"
      role="status"
      aria-label={t('common.loading')}
    >
      <div className="flex flex-col items-center gap-5">
        <BrandMark showName={false} className="motion-safe:animate-pulse" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    </div>
  );
}
