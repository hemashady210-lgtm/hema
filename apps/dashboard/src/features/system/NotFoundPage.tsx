import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/brand-mark';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';

export function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('notFound.title'));
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-10 px-6 py-16">
      <BrandMark />
      <EmptyState
        icon={Compass}
        title={t('notFound.title')}
        body={t('notFound.body')}
        action={
          <Button asChild>
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
        }
      />
    </main>
  );
}
