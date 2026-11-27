import { useQuery } from '@tanstack/react-query';
import type { Locale, WorkspaceRole } from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { supabase } from '@/lib/supabase';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  country_code: string | null;
  timezone: string;
  default_locale: Locale;
  status: 'active' | 'read_only' | 'suspended' | 'pending_deletion';
}

export interface Membership {
  role: WorkspaceRole;
  joined_at: string;
  workspace: Workspace;
}

export const membershipsKey = (userId: string | undefined) => ['memberships', userId] as const;

/** Workspaces the signed-in user is an active member of (RLS-scoped read). */
export function useMemberships() {
  const { user } = useAuth();
  return useQuery({
    queryKey: membershipsKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(
          'role, created_at, workspace:workspaces!inner(id, name, slug, category, country_code, timezone, default_locale, status)',
        )
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        role: row.role as WorkspaceRole,
        joined_at: row.created_at,
        workspace: row.workspace as unknown as Workspace,
      }));
    },
  });
}

export interface LiveSubscription {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export function useSubscription(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['subscription', workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<LiveSubscription | null> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at, current_period_end')
        .eq('workspace_id', workspaceId!)
        .in('status', ['trialing', 'active', 'past_due', 'grace', 'suspended'])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Resolved entitlements (plan + overrides) by key — never compare plan codes (CLAUDE.md). */
export function useEntitlements(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['entitlements', workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.rpc('get_workspace_entitlements', {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
  });
}

export function useIsPlatformAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['platform-admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
    staleTime: 5 * 60_000,
  });
}

export interface NotificationRow {
  id: string;
  type: string;
  title: Record<string, string>;
  body: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(workspaceId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', workspaceId, user?.id],
    enabled: !!workspaceId && !!user,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read_at, created_at')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationRow[];
    },
  });
}
