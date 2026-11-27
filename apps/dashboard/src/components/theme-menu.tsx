import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/auth';
import { usePreferences, type ThemePreference } from '@/app/preferences';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor } as const;

export function ThemeMenu() {
  const { t } = useTranslation();
  const { theme, resolvedTheme } = usePreferences();
  const { setTheme } = useAuth();
  const Icon = resolvedTheme === 'light' ? Sun : Moon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('theme.label')} data-testid="theme-menu">
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('theme.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          {(['dark', 'light', 'system'] as const).map((value) => {
            const ItemIcon = THEME_ICONS[value];
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <ItemIcon aria-hidden />
                {t(`theme.${value}`)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
