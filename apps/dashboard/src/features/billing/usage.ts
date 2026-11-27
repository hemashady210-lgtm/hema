import { useQuery } from '@tanstack/react-query';
import { useInvitations, useMembers } from '@/features/members/queries';
import { usePermissions } from '@/features/permissions/use-permissions';
import { useEntitlements } from '@/features/workspaces/queries';
import { supabase } from '@/lib/supabase';

/**
 * Real plan numbers for the UI (DECISIONS H6/H7). Limits come from the workspace's resolved
 * entitlements (plan + overrides) by key — never from plan codes or copy. Hooks report errors
 * and "unknown" separately from real values, so the UI never shows a default as if it were
 * data (CLAUDE.md: never fake a status).
 */

/**
 * A limit from resolved entitlements: a number, `null` = unlimited (the key is present with a
 * JSON null), or unknown (key missing / entitlements not loaded).
 */
export type Limit = { known: true; value: number | null } | { known: false };

export function readLimit(entitlements: Record<string, unknown> | undefined, key: string): Limit {
  if (!entitlements || !(key in entitlements)) return { known: false };
  const v = entitlements[key];
  if (v === null) return { known: true, value: null };
  return typeof v === 'number' && Number.isFinite(v) ? { known: true, value: v } : { known: false };
}

/**
 * Seats in use = active members + open (unexpired) invitations (decision G4). Members who can't
 * see invitations (RLS: owner/admin only) get the member count, and `includesInvites` says so.
 */
export function useSeatUsage(workspaceId: string) {
  const perms = usePermissions();
  const canSeeInvites = perms.can('members.invite');
  const members = useMembers(workspaceId);
  const invitations = useInvitations(workspaceId, canSeeInvites);
  const entitlements = useEntitlements(workspaceId);
  const now = Date.now();
  const openInvites = (invitations.data ?? []).filter(
    (i) => new Date(i.expires_at).getTime() > now,
  ).length;
  const limit = readLimit(entitlements.data, 'max_users');
  return {
    used: (members.data?.length ?? 0) + openInvites,
    members: members.data?.length ?? 0,
    openInvites,
    /** Seat limit; null when unlimited or unknown — check `limitKnown`. */
    limit: limit.known ? limit.value : null,
    limitKnown: limit.known,
    includesInvites: canSeeInvites,
    loading:
      members.isLoading || entitlements.isLoading || (canSeeInvites && invitations.isLoading),
    error: members.error ?? (canSeeInvites ? invitations.error : null) ?? entitlements.error,
    refetch: () => {
      void members.refetch();
      void entitlements.refetch();
      if (canSeeInvites) void invitations.refetch();
    },
  };
}

interface UsagePeriodRow {
  ai_replies_used: number;
  ai_replies_included: number | null;
  period_end: string;
}

/**
 * AI replies in the current, open period (same rule as private.ensure_usage_period: not
 * closed, now inside the window). The period row is opened by the first metered reply, so
 * `period === null` means "no replies yet this period" — an empty state, not a zero default.
 */
export function useAiReplyUsage(workspaceId: string) {
  const entitlements = useEntitlements(workspaceId);
  const period = useQuery({
    queryKey: ['usage-period', workspaceId],
    queryFn: async (): Promise<UsagePeriodRow | null> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('usage_periods')
        .select('ai_replies_used, ai_replies_included, period_end')
        .eq('workspace_id', workspaceId)
        .is('closed_at', null)
        .lte('period_start', nowIso)
        .gt('period_end', nowIso)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as UsagePeriodRow | null) ?? null;
    },
  });
  const allowance = readLimit(entitlements.data, 'ai_replies_per_period');
  const row = period.data ?? null;
  return {
    /** The open period, or null when no reply has been metered yet this period. */
    period: row,
    used: row?.ai_replies_used ?? null,
    /** The period's snapshot wins; before a period opens, the plan's allowance. */
    limit: row ? row.ai_replies_included : allowance.known ? allowance.value : null,
    limitKnown: row ? true : allowance.known,
    loading: period.isLoading || entitlements.isLoading,
    error: period.error ?? entitlements.error,
    refetch: () => {
      void period.refetch();
      void entitlements.refetch();
    },
  };
}
