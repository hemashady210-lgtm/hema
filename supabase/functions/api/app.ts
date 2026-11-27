// `api` Edge Function (E7): dashboard business-rule writes for P3 — workspaces, invitations,
// members. Reads stay on supabase-js + RLS (P3). Every route: CORS for dashboard origins,
// request id, structured log, error envelope (docs/API.md §2), zod validation, rate limits.
import { BRAND, type Locale } from '@ai-crm/shared';
import { requireUser } from '../_shared/auth.ts';
import type { AuthPort, AuthUser, Db } from '../_shared/db.ts';
import type { Env } from '../_shared/env.ts';
import {
  ApiError,
  corsHeaders,
  errorResponse,
  json,
  requestId,
  requestLocale,
} from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';
import type { Mailer } from '../_shared/email/resend.ts';
import { functionPath, match, type Route } from '../_shared/router.ts';
import { invitationRoutes } from './routes/invitations.ts';
import { memberRoutes } from './routes/members.ts';
import { workspaceRoutes } from './routes/workspaces.ts';

export interface Deps {
  env: Env;
  db: Db;
  auth: AuthPort;
  mailer: Mailer;
  logger: Logger;
}

export interface Ctx {
  req: Request;
  url: URL;
  deps: Deps;
  locale: Locale;
  requestId: string;
  log: Logger;
  /** Cached per request. */
  user(): Promise<AuthUser>;
}

function allRoutes(): Route<Ctx>[] {
  return [...workspaceRoutes, ...invitationRoutes, ...memberRoutes];
}

export function createApp(deps: Deps): (req: Request) => Promise<Response> {
  const routes = allRoutes();
  return async (req) => {
    const started = Date.now();
    const reqId = requestId(req);
    const locale = requestLocale(req);
    const url = new URL(req.url);
    const path = functionPath(url.pathname, 'api');
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    const log = deps.logger.child({ request_id: reqId, method: req.method, path });

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let response: Response;
    let user: Promise<AuthUser> | null = null;
    const ctx: Ctx = {
      req,
      url,
      deps,
      locale,
      requestId: reqId,
      log,
      user: () => (user ??= requireUser(req, deps.auth)),
    };
    try {
      if (req.method === 'GET' && path === '/health') {
        // R-14 probe: BRAND comes from packages/shared, bundled with the function.
        response = json({ ok: true, service: 'api', product: BRAND.productName });
      } else if (req.method === 'GET' && path === '/v1/config') {
        await ctx.user();
        response = json({
          email_delivery: deps.mailer.configured ? 'configured' : 'not_configured',
        });
      } else {
        const m = match(routes, req.method, path);
        if (m.kind === 'not_found') throw new ApiError('not_found');
        if (m.kind === 'method_not_allowed') throw new ApiError('not_found', { reason: 'method' });
        response = await m.route.handler(ctx, m.params);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        response = errorResponse(err, locale, reqId);
        if (err.code === 'internal') log.log('error', 'internal error', { detail: err.details });
      } else {
        log.log('error', 'unhandled error', {
          error: err instanceof Error ? err.message : String(err),
        });
        response = errorResponse(new ApiError('internal'), locale, reqId);
      }
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    headers.set('x-request-id', reqId);
    headers.set('cache-control', 'no-store');
    log.log('info', 'request', { status: response.status, ms: Date.now() - started });
    return new Response(response.body, { status: response.status, headers });
  };
}
