import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './env.ts';
import type { PgError } from './errors.ts';

export interface RpcResult<T> {
  data: T | null;
  error: PgError | null;
}

/** The narrow slice of the database the API uses (service role). Faked in tests. */
export interface Db {
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>>;
  /** Workspace id of an invitation, or null. Used to bind path params to rows. */
  invitationWorkspaceId(invitationId: string): Promise<string | null>;
  /** Display data for emails. */
  workspaceName(workspaceId: string): Promise<string | null>;
  profileName(userId: string): Promise<string | null>;
}

export interface AuthUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
}

export interface AuthPort {
  /** Verifies an access token with Supabase Auth (authoritative: revoked sessions fail). */
  getUser(jwt: string): Promise<AuthUser | null>;
}

export function createAdminClient(env: Env): SupabaseClient {
  return createClient(env.supabaseUrl, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-client-info': 'ai-crm-api' } },
  });
}

export function supabaseDb(client: SupabaseClient): Db {
  return {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await client.rpc(fn, args);
      return {
        data: (data as T) ?? null,
        error: error ? { code: error.code, message: error.message } : null,
      };
    },
    async invitationWorkspaceId(id) {
      const { data } = await client
        .from('workspace_invitations')
        .select('workspace_id')
        .eq('id', id)
        .maybeSingle();
      return (data?.workspace_id as string | undefined) ?? null;
    },
    async workspaceName(id) {
      const { data } = await client
        .from('workspaces')
        .select('name')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      return (data?.name as string | undefined) ?? null;
    },
    async profileName(id) {
      const { data } = await client.from('profiles').select('full_name').eq('id', id).maybeSingle();
      return (data?.full_name as string | undefined) ?? null;
    },
  };
}

export function supabaseAuth(client: SupabaseClient): AuthPort {
  return {
    async getUser(jwt) {
      const { data, error } = await client.auth.getUser(jwt);
      if (error || !data.user) return null;
      return {
        id: data.user.id,
        email: data.user.email?.toLowerCase() ?? null,
        emailConfirmed: !!data.user.email_confirmed_at,
      };
    },
  };
}
