import { changeMemberRoleSchema, transferOwnershipSchema } from '@ai-crm/shared';
import type { Ctx } from '../app.ts';
import { json } from '../../_shared/http.ts';
import { route, type Route } from '../../_shared/router.ts';
import { readJson, requireUuid } from '../../_shared/validation.ts';
import { LIMITS, limit, rpc } from './util.ts';

export const memberRoutes: Route<Ctx>[] = [
  // PATCH /v1/workspaces/{ws}/members/{user_id} {role} — owner/admin; never the owner or self.
  route('PATCH', '/v1/workspaces/:ws/members/:userId', async (ctx, p) => {
    const user = await ctx.user();
    const ws = requireUuid(p.ws);
    const target = requireUuid(p.userId);
    await limit(ctx, `members:${user.id}`, LIMITS.members);
    const { role } = await readJson(ctx.req, changeMemberRoleSchema);
    await rpc(ctx, 'change_member_role', {
      p_actor_id: user.id,
      p_workspace_id: ws,
      p_user_id: target,
      p_role: role,
    });
    return json({ user_id: target, role });
  }),

  // DELETE /v1/workspaces/{ws}/members/{user_id} — remove (owner/admin) or leave (self).
  route('DELETE', '/v1/workspaces/:ws/members/:userId', async (ctx, p) => {
    const user = await ctx.user();
    const ws = requireUuid(p.ws);
    const target = requireUuid(p.userId);
    await limit(ctx, `members:${user.id}`, LIMITS.members);
    await rpc(ctx, 'remove_member', { p_actor_id: user.id, p_workspace_id: ws, p_user_id: target });
    return json(null, 204);
  }),

  // POST /v1/workspaces/{ws}/ownership {user_id} — owner only; old owner becomes admin.
  route('POST', '/v1/workspaces/:ws/ownership', async (ctx, p) => {
    const user = await ctx.user();
    const ws = requireUuid(p.ws);
    await limit(ctx, `members:${user.id}`, LIMITS.members);
    const { user_id } = await readJson(ctx.req, transferOwnershipSchema);
    await rpc(ctx, 'transfer_ownership', {
      p_actor_id: user.id,
      p_workspace_id: ws,
      p_new_owner_id: requireUuid(user_id),
    });
    return json({ owner_id: user_id });
  }),
];
