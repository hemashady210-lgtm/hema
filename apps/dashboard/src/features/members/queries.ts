import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiConfigResponse,
  CreateInvitationResponse,
  EmailDeliveryStatus,
  InvitableRole,
  Locale,
  WorkspaceRole,
} from '@ai-crm/shared';
import { useAuth } from '@/app/auth';
import { membershipsKey } from '@/features/workspaces/queries';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export interface MemberRow {
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: InvitableRole;
  expires_at: string;
  created_at: string;
  email_status: EmailDeliveryStatus;
  locale: Locale;
}

export const membersKey = (ws: string) => ['members', ws] as const;
export const invitationsKey = (ws: string) => ['invitations', ws] as const;

const ROLE_ORDER: Record<WorkspaceRole, number> = { owner: 0, admin: 1, agent: 2, viewer: 3 };

/** Members (RLS: any member) + their profiles (RLS: teammates are visible). */
export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: membersKey(workspaceId),
    queryFn: async (): Promise<MemberRow[]> => {
      const { data: members, error } = await supabase
        .from('workspace_members')
        .select('user_id, role, created_at')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      const { data: profiles, error: pe } = ids.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', ids)
        : { data: [], error: null };
      if (pe) throw pe;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (members ?? [])
        .map((m) => ({
          user_id: m.user_id,
          role: m.role as WorkspaceRole,
          created_at: m.created_at,
          full_name: byId.get(m.user_id)?.full_name ?? null,
          email: byId.get(m.user_id)?.email ?? null,
        }))
        .sort(
          (a, b) =>
            ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.created_at.localeCompare(b.created_at),
        );
    },
  });
}

/** Open invitations (RLS: owner/admin only). Never selects token_hash (not client-readable). */
export function useInvitations(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: invitationsKey(workspaceId),
    enabled,
    queryFn: async (): Promise<InvitationRow[]> => {
      const { data, error } = await supabase
        .from('workspace_invitations')
        .select('id, email, role, expires_at, created_at, email_status, locale')
        .eq('workspace_id', workspaceId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvitationRow[];
    },
  });
}

export function useApiConfig() {
  return useQuery({
    queryKey: ['api-config'],
    queryFn: () => api<ApiConfigResponse>('/v1/config'),
    staleTime: 5 * 60_000,
  });
}

/** Mutations through the `api` function; every success refreshes the affected lists. */
export function useMemberMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: invitationsKey(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: membershipsKey(user?.id) }),
    ]);
  };
  return {
    invite: useMutation({
      mutationFn: (body: { email: string; role: InvitableRole; locale: Locale }) =>
        api<CreateInvitationResponse>(`/v1/workspaces/${workspaceId}/invitations`, { body }),
      onSuccess: refresh,
    }),
    renew: useMutation({
      mutationFn: (id: string) =>
        api<CreateInvitationResponse>(`/v1/workspaces/${workspaceId}/invitations/${id}/renew`, {
          method: 'POST',
        }),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (id: string) =>
        api<void>(`/v1/workspaces/${workspaceId}/invitations/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    changeRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: InvitableRole }) =>
        api(`/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'PATCH', body: { role } }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (userId: string) =>
        api<void>(`/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    /** Leaving: the caller navigates away first, then updates the caches (no "not found" flash). */
    leave: useMutation({
      mutationFn: (userId: string) =>
        api<void>(`/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
    }),
    transfer: useMutation({
      mutationFn: (userId: string) =>
        api(`/v1/workspaces/${workspaceId}/ownership`, { body: { user_id: userId } }),
      onSuccess: refresh,
    }),
  };
}
