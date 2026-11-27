import { useQuery } from '@tanstack/react-query';
import { useInvitations, useMembers } from '@/features/members/queries';
import { usePermissions } from '@/features/permissions/use-permissions';
import { useEntitlements } from '@/features/workspaces/queries';
import { supabase } from '@/lib/supabase';

/**
 * Real plan numbers for the UI (DECISIONS H6/H7). Limits come from the workspace's resolved
 * entitlements (plan + overrides) by key — never from plan codes or copy.
 */

const numberOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Seats in use = active members + open (unexpired) invitations (decision G4). Members who can't
 * see invitations (RLS: owner/admin only) get the member count, and `includesInvites` says so.
 */
export function useSeatUsage(workspaceId: string) {
  const perms = usePermissions();
  const canSeeInvites = perms.can('members.invite');
  const members = useMembers(workspaceId);
  const invitations = useInvitations(workspaceId, canSeeInvites);
  const { data: entitlements, isLoading: entLoading } = useEntitlements(workspaceId);
  const now = Date.now();
  const openInvites = (invitations.data ?? []).filter(
    (i) => new Date(i.expires_at).getTime() > now,
  ).length;
  return {
    used: (members.data?.length ?? 0) + openInvites,
    members: members.data?.length ?? 0,
    openInvites,
    limit: numberOrNull(entitlements?.max_users),
    includesInvites: canSeeInvites,
    loading: members.isLoading || entLoading || (canSeeInvites && invitations.isLoading),
  };
}

interface UsagePeriodRow {
  ai_replies_used: number;
  ai_replies_included: number | null;
  period_end: string;
}

/**
 * AI replies in the current period. The period row is opened by the first metered reply
 * (consume_ai_reply), so "no row" truthfully means 0 used against the plan's allowance.
 */
export function useAiReplyUsage(workspaceId: string) {
  const { data: entitlements, isLoading: entLoading } = useEntitlements(workspaceId);
  const period = useQuery({
    queryKey: ['usage-period', workspaceId],
    queryFn: async (): Promise<UsagePeriodRow | null> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('usage_periods')
        .select('ai_replies_used, ai_replies_included, period_end')
        .eq('workspace_id', workspaceId)
        .lte('period_start', nowIso)
        .gt('period_end', nowIso)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as UsagePeriodRow | null;
    },
  });
  const allowance = period.data
    ? period.data.ai_replies_included
    : numberOrNull(entitlements?.ai_replies_per_period);
  return {
    used: period.data?.ai_replies_used ?? 0,
    limit: allowance,
    loading: period.isLoading || entLoading,
    error: period.error,
  };
}

/** Share of a limit used, for meters: < 80 % primary, ≥ 80 % warning, 100 % danger (§8). */
export function usageTone(used: number, limit: number | null): 'primary' | 'warning' | 'danger' {
  if (limit === null || limit <= 0) return 'primary';
  const share = used / limit;
  return share >= 1 ? 'danger' : share >= 0.8 ? 'warning' : 'primary';
}
