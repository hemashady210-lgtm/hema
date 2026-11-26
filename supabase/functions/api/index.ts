// `api` Edge Function (E7). Skeleton for the local stack; routes land in P3 M3.
import { BRAND } from '@ai-crm/shared';

Deno.serve((req) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/health')) {
    return Response.json({ ok: true, product: BRAND.productName });
  }
  return Response.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 });
});
