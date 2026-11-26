import { useNavigate } from 'react-router';
import { LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/app/auth';
import { Avatar } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/format';

export function UserMenu({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const name = profile?.full_name ?? user?.email ?? '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('shell.userMenu')}
          data-testid="user-menu"
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Avatar name={initials(profile?.full_name, user?.email)} className="size-8" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={initials(profile?.full_name, user?.email)} className="size-9" />
          <div className="flex min-w-0 flex-col">
            <bdi className="truncate text-callout font-semibold text-text-primary">{name}</bdi>
            <span dir="ltr" className="truncate text-start text-footnote text-text-tertiary">
              {user?.email}
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(`/w/${slug}/account`)}>
          <UserRound aria-hidden />
          {t('shell.account')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            toast(t('auth.signedOut'));
            navigate('/auth/sign-in', { replace: true });
          }}
        >
          <LogOut aria-hidden className="rtl-mirror" />
          {t('shell.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
