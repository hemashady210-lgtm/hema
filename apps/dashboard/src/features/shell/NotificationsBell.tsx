import { Bell, BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/app/preferences';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmptyState } from '@/components/empty-state';
import { useNotifications } from '@/features/workspaces/queries';
import { formatDate } from '@/lib/format';

/** In-app notifications from the real `notifications` table (producers arrive in P15). */
export function NotificationsBell({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const { data, isPending } = useNotifications(workspaceId);
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('shell.notifications')}
          className="relative"
          data-testid="notifications"
        >
          <Bell aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute end-2 top-2 size-2 rounded-full bg-accent ring-2 ring-background"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))]">
        <div className="border-b px-4 py-3">
          <p className="text-headline font-semibold">{t('shell.notifications')}</p>
        </div>
        <div className="max-h-96 overflow-y-auto p-4">
          {isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : data && data.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {data.map((n) => (
                <li key={n.id} className="flex flex-col gap-0.5">
                  <p className="text-callout font-medium">
                    {n.title[locale] ?? n.title.en ?? n.title.ar}
                  </p>
                  {n.body ? (
                    <p className="text-footnote text-text-secondary">
                      {n.body[locale] ?? n.body.en}
                    </p>
                  ) : null}
                  <p className="text-caption text-text-tertiary">
                    {formatDate(n.created_at, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={BellOff}
              title={t('shell.noNotificationsTitle')}
              body={t('shell.noNotificationsBody')}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
