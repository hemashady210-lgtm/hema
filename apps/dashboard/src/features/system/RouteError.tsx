import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

/** Error boundary for the router: never a blank screen. */
export function RouteError() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <EmptyState
        icon={TriangleAlert}
        title={t('crash.title')}
        body={t('crash.body')}
        action={<Button onClick={() => window.location.reload()}>{t('crash.reload')}</Button>}
      />
    </main>
  );
}
