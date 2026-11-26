// Session + profile. Supabase Auth persists the session (localStorage, PKCE). The profile row
// (auto-created by the auth trigger, 0015) holds the user's language and theme; they are applied
// when the user signs in and written back when the user changes them.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Locale } from '@ai-crm/shared';
import { supabase } from '@/lib/supabase';
import { isLocale } from '@/i18n';
import { isTheme, usePreferences, type ThemePreference } from './preferences';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_path: string | null;
  locale: Locale;
  theme: ThemePreference;
}

interface AuthValue {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been read. */
  loading: boolean;
  /** Set after a password-recovery link was opened. */
  recovery: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  signOut(): Promise<void>;
  /** Language/theme change: applied locally and saved on the profile when signed in. */
  setLocale(locale: Locale): void;
  setTheme(theme: ThemePreference): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export const profileKey = (userId: string | undefined) => ['profile', userId] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const prefs = usePreferences();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
      setSession(next);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') {
        setRecovery(false);
        queryClient.clear();
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const user = session?.user ?? null;
  const profileQuery = useQuery({
    queryKey: profileKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_path, locale, theme')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        locale: isLocale(data.locale) ? data.locale : 'ar',
        theme: isTheme(data.theme) ? data.theme : 'dark',
      };
    },
    staleTime: 60_000,
  });
  const profile = profileQuery.data ?? null;

  // Apply the saved preferences once per signed-in user.
  const syncedFor = useRef<string | null>(null);
  const { setLocale: applyLocale, setTheme: applyTheme, locale, theme } = prefs;
  useEffect(() => {
    if (!profile || !user || syncedFor.current === profile.id) return;
    syncedFor.current = profile.id;
    // A brand-new account (email-link sign-up, OAuth) keeps the language and theme the visitor
    // chose before signing up, instead of the profile defaults.
    const fresh = Date.now() - new Date(user.created_at).getTime() < 10 * 60_000;
    if (fresh) {
      if (profile.locale !== locale || profile.theme !== theme) {
        queryClient.setQueryData<Profile | null>(profileKey(user.id), (p) =>
          p ? { ...p, locale, theme } : p,
        );
        void supabase.from('profiles').update({ locale, theme }).eq('id', user.id);
      }
      return;
    }
    if (profile.locale !== locale) applyLocale(profile.locale);
    if (profile.theme !== theme) applyTheme(profile.theme);
  }, [profile, user, locale, theme, applyLocale, applyTheme, queryClient]);
  useEffect(() => {
    if (!user) syncedFor.current = null;
  }, [user]);

  const savePreference = useCallback(
    async (patch: Partial<Pick<Profile, 'locale' | 'theme'>>) => {
      if (!user) return;
      queryClient.setQueryData<Profile | null>(profileKey(user.id), (p) =>
        p ? { ...p, ...patch } : p,
      );
      await supabase.from('profiles').update(patch).eq('id', user.id);
    },
    [user, queryClient],
  );

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user,
      loading,
      recovery,
      profile,
      profileLoading: !!user && profileQuery.isPending,
      async signOut() {
        await supabase.auth.signOut();
      },
      setLocale(next) {
        applyLocale(next);
        void savePreference({ locale: next });
      },
      setTheme(next) {
        applyTheme(next);
        void savePreference({ theme: next });
      },
    }),
    [
      session,
      user,
      loading,
      recovery,
      profile,
      profileQuery.isPending,
      applyLocale,
      applyTheme,
      savePreference,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
