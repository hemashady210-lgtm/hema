import { createWorkspaceSchema, slugSchema } from '@ai-crm/shared';
import type { Ctx } from '../app.ts';
import { ApiError, json } from '../../_shared/http.ts';
import { route, type Route } from '../../_shared/router.ts';
import { readJson } from '../../_shared/validation.ts';
import { LIMITS, limit, rpc } from './util.ts';

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  country_code: string | null;
  timezone: string;
  default_locale: string;
  status: string;
  created_at: string;
}

export const workspaceRoutes: Route<Ctx>[] = [
  // GET /v1/workspaces/slug-availability?slug=… — live check in the create form.
  route('GET', '/v1/workspaces/slug-availability', async (ctx) => {
    const user = await ctx.user();
    await limit(ctx, `slug:${user.id}`, LIMITS.slugCheck);
    const raw = ctx.url.searchParams.get('slug') ?? '';
    const parsed = slugSchema.safeParse(raw);
    if (!parsed.success) return json({ slug: raw, available: false, reason: 'format' });
    const available = await rpc<boolean>(ctx, 'is_slug_available', { p_slug: parsed.data });
    return json({ slug: parsed.data, available: !!available });
  }),

  // POST /v1/workspaces — workspace + owner + 7-day trial + onboarding row (atomic, 0015).
  route('POST', '/v1/workspaces', async (ctx) => {
    const user = await ctx.user();
    if (!user.emailConfirmed) throw new ApiError('email_not_verified');
    await limit(ctx, `ws_create:${user.id}`, LIMITS.createWorkspace);
    const input = await readJson(ctx.req, createWorkspaceSchema);
    const ws = await rpc<WorkspaceRow>(ctx, 'create_workspace', {
      p_user_id: user.id,
      p_name: input.name,
      p_slug: input.slug,
      p_category: input.category,
      p_country_code: input.country_code,
      p_timezone: input.timezone,
      p_default_locale: input.default_locale,
    });
    ctx.log.log('info', 'workspace created', { workspace_id: ws.id });
    return json(
      {
        workspace: {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          category: ws.category,
          country_code: ws.country_code,
          timezone: ws.timezone,
          default_locale: ws.default_locale,
          status: ws.status,
          created_at: ws.created_at,
        },
      },
      201,
    );
  }),
];
