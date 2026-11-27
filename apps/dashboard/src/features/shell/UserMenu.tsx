import { useNavigate } from 'react-router';
import { Languages, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/app/auth';
import { usePreferences, type ThemePreference } from '@/app/preferences';
import { Avatar } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/format';

export function UserMenu({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Preference setters come from auth: they apply locally AND save to the profile, so the
  // choice survives reloads and follows the person to other devices (review finding 1).
  const { profile, user, signOut, setLocale, setTheme } = useAuth();
  const { locale, theme } = usePreferences();
  const other = locale === 'ar' ? 'en' : 'ar';
  const name = profile?.full_name ?? user?.email ?? '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('shell.userMenu')}
          data-testid="user-menu"
          className="grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:size-11"
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
        {/* Preferences (also on Account and in ⌘K). Language switches in place, no reload. */}
        <DropdownMenuItem onSelect={() => setLocale(other)}>
          <Languages aria-hidden />
          <span lang={other}>{t(`language.${other}`)}</span>
        </DropdownMenuItem>
        <DropdownMenuLabel className="pt-2">{t('theme.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          {(
            [
              ['dark', Moon],
              ['light', Sun],
              ['system', Monitor],
            ] as const
          ).map(([value, Icon]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden />
              {t(`theme.${value}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
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
