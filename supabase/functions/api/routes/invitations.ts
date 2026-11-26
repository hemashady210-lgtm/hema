import {
  createInvitationSchema,
  invitationTokenBodySchema,
  maskEmail,
  type CreateInvitationResponse,
  type EmailDeliveryStatus,
  type InvitationPreviewResponse,
  type InvitationState,
  type Locale,
} from '@ai-crm/shared';
import type { Ctx } from '../app.ts';
import { optionalUser } from '../../_shared/auth.ts';
import { randomToken, sha256Hex } from '../../_shared/crypto.ts';
import { invitationEmail } from '../../_shared/email/invitation.ts';
import { ApiError, clientIp, json } from '../../_shared/http.ts';
import { route, type Route } from '../../_shared/router.ts';
import { readJson, requireUuid } from '../../_shared/validation.ts';
import { LIMITS, limit, rpc } from './util.ts';

interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'agent' | 'viewer';
  expires_at: string;
  locale: Locale;
  email_status: EmailDeliveryStatus;
}

interface PreviewRow {
  invitation_id: string;
  workspace_name: string;
  role: 'admin' | 'agent' | 'viewer';
  email: string;
  inviter_name: string | null;
  expires_at: string;
  state: InvitationState;
}

interface AcceptRow {
  workspace_id: string;
  workspace_slug: string;
  member_role: string;
}

async function assertInvitationInWorkspace(ctx: Ctx, invitationId: string, workspaceId: string) {
  const ws = await ctx.deps.db.invitationWorkspaceId(invitationId);
  if (ws !== workspaceId) throw new ApiError('not_found');
}

/** Emails the link when Resend is configured and records what really happened. */
async function deliver(
  ctx: Ctx,
  inv: InvitationRow,
  token: string,
  actorId: string,
): Promise<CreateInvitationResponse> {
  if (!ctx.deps.env.appUrl) {
    ctx.log.log('error', 'APP_URL is not configured; cannot build invitation links');
    throw new ApiError('internal', { reason: 'app_url_not_configured' });
  }
  const inviteUrl = `${ctx.deps.env.appUrl}/invite/${token}`;
  let status: EmailDeliveryStatus = 'not_configured';
  let error: string | null = null;
  if (ctx.deps.mailer.configured) {
    const [workspaceName, inviterName] = await Promise.all([
      ctx.deps.db.workspaceName(inv.workspace_id),
      ctx.deps.db.profileName(actorId),
    ]);
    const mail = invitationEmail({
      locale: inv.locale,
      workspaceName: workspaceName ?? '',
      inviterName,
      role: inv.role,
      url: inviteUrl,
      expiresAt: new Date(inv.expires_at),
    });
    const result = await ctx.deps.mailer.send({
      to: inv.email,
      ...mail,
      idempotencyKey: `invitation:${inv.id}:${(await sha256Hex(token)).slice(0, 16)}`,
    });
    status = result.status;
    if (result.status === 'failed') {
      error = result.error;
      ctx.log.log('warn', 'invitation email failed', { invitation_id: inv.id });
    }
  }
  await rpc(ctx, 'set_invitation_email_status', {
    p_invitation_id: inv.id,
    p_status: status,
    p_error: error,
  });
  return {
    invitation: {
      id: inv.id,
      workspace_id: inv.workspace_id,
      email: inv.email,
      role: inv.role,
      expires_at: inv.expires_at,
      locale: inv.locale,
      email_status: status,
    },
    invite_url: inviteUrl,
    email_status: status,
  };
}

export const invitationRoutes: Route<Ctx>[] = [
  // POST /v1/workspaces/{ws}/invitations — owner/admin; checks max_users (members + open invites).
  route('POST', '/v1/workspaces/:ws/invitations', async (ctx, p) => {
    const user = await ctx.user();
    const ws = requireUuid(p.ws);
    await limit(ctx, `invite:${user.id}`, LIMITS.invite);
    const input = await readJson(ctx.req, createInvitationSchema);
    const token = randomToken();
    const inv = await rpc<InvitationRow>(ctx, 'create_invitation', {
      p_actor_id: user.id,
      p_workspace_id: ws,
      p_email: input.email,
      p_role: input.role,
      p_token_hash: await sha256Hex(token),
      p_locale: input.locale,
    });
    return json(await deliver(ctx, inv, token, user.id), 201);
  }),

  // POST /v1/workspaces/{ws}/invitations/{id}/renew — new link (old one stops working) + resend.
  route('POST', '/v1/workspaces/:ws/invitations/:id/renew', async (ctx, p) => {
    const user = await ctx.user();
    const ws = requireUuid(p.ws);
    const id = requireUuid(p.id);
    await limit(ctx, `invite:${user.id}`, LIMITS.invite);
    await assertInvitationInWorkspace(ctx, id, ws);
    const token = randomToken();
    const inv = await rpc<InvitationRow>(ctx, 'renew_invitation', {
      p_actor_id: user.id,
      p_invitation_id: id,
      p_token_hash: await sha256Hex(token),
    });
    return json(await deliver(ctx, inv, token, user.id));
  }),

  // DELETE /v1/workspaces/{ws}/invitations/{id} — revoke.
  route('DELETE', '/v1/workspaces/:ws/invitations/:id', async (ctx, p) => {
    const user = await ctx.user();
    const ws = requireUuid(p.ws);
    const id = requireUuid(p.id);
    await limit(ctx, `members:${user.id}`, LIMITS.members);
    await assertInvitationInWorkspace(ctx, id, ws);
    await rpc(ctx, 'revoke_invitation', { p_actor_id: user.id, p_invitation_id: id });
    return json(null, 204);
  }),

  // POST /v1/invitations/preview {token} — public (the link may be opened signed out).
  // POST keeps the token out of URLs and access logs.
  route('POST', '/v1/invitations/preview', async (ctx) => {
    await limit(ctx, `preview:${clientIp(ctx.req)}`, LIMITS.preview);
    const { token } = await readJson(ctx.req, invitationTokenBodySchema);
    const rows = await rpc<PreviewRow[]>(ctx, 'get_invitation_preview', {
      p_token_hash: await sha256Hex(token),
    });
    const row = rows?.[0];
    if (!row) throw new ApiError('invitation_not_found');
    const caller = await optionalUser(ctx.req, ctx.deps.auth);
    const matches = caller ? caller.email === row.email : null;
    const body: InvitationPreviewResponse = {
      workspace_name: row.workspace_name,
      role: row.role,
      email: matches ? row.email : maskEmail(row.email),
      email_matches_caller: matches,
      inviter_name: row.inviter_name,
      expires_at: row.expires_at,
      state: row.state,
    };
    return json(body);
  }),

  // POST /v1/invitations/accept {token} — signed-in invitee with the invited, verified email.
  route('POST', '/v1/invitations/accept', async (ctx) => {
    const user = await ctx.user();
    await limit(ctx, `accept:${user.id}`, LIMITS.accept);
    const { token } = await readJson(ctx.req, invitationTokenBodySchema);
    const rows = await rpc<AcceptRow[]>(ctx, 'accept_invitation', {
      p_user_id: user.id,
      p_token_hash: await sha256Hex(token),
    });
    const row = rows?.[0];
    if (!row) throw new ApiError('internal');
    ctx.log.log('info', 'invitation accepted', { workspace_id: row.workspace_id });
    return json({
      workspace_id: row.workspace_id,
      workspace_slug: row.workspace_slug,
      role: row.member_role,
    });
  }),
];
