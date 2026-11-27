import { useEffect, useMemo } from 'react';
import { Navigate, useParams } from 'react-router';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { NotFoundPage } from '@/features/system/NotFoundPage';
import { AppShell } from '@/features/shell/AppShell';
import { errorMessage } from '@/lib/errors';
import { storage } from '@/lib/storage';
import { useTranslation } from 'react-i18next';
import { WorkspaceContext, type WorkspaceContextValue } from './context';
import { useMemberships } from './queries';

/** Resolves /w/:slug against the user's memberships (RLS) and renders the shell. */
export function WorkspaceLayout() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { data, isPending, error, refetch } = useMemberships();
  const membership = data?.find((m) => m.workspace.slug === slug);

  useEffect(() => {
    if (membership) storage.set('last-workspace', membership.workspace.slug);
  }, [membership]);

  const value = useMemo<WorkspaceContextValue | null>(
    () =>
      membership && data
        ? { workspace: membership.workspace, role: membership.role, memberships: data }
        : null,
    [membership, data],
  );

  if (isPending) return <ShellSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <InlineAlert
          tone="danger"
          title={t('common.somethingWrong')}
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {errorMessage(t, error)}
        </InlineAlert>
      </div>
    );
  }
  if (!value) return <NotFoundPage />;
  return (
    <WorkspaceContext.Provider value={value}>
      <AppShell />
    </WorkspaceContext.Provider>
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy>
      <div className="hidden w-[264px] flex-col gap-3 border-e bg-surface-1 p-4 lg:flex">
        <Skeleton className="h-7 w-32" />
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b px-5">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="ms-auto size-8 rounded-full" />
        </div>
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-10">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

/** `/` → last used workspace, else the first one, else create one. */
export function RootRedirect() {
  const { data, isPending } = useMemberships();
  if (isPending) return <ShellSkeleton />;
  if (!data || data.length === 0) return <Navigate to="/onboarding/workspace" replace />;
  const last = storage.get('last-workspace');
  const target = data.find((m) => m.workspace.slug === last) ?? data[0]!;
  return <Navigate to={`/w/${target.workspace.slug}`} replace />;
}
