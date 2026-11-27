import type { AuthPort, AuthUser } from './db.ts';
import { ApiError } from './http.ts';

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  const token = m?.[1]?.trim();
  // New-style API keys are not user tokens (docs: guides/functions/auth-headers).
  if (!token || token.startsWith('sb_')) return null;
  return token;
}

export async function requireUser(req: Request, auth: AuthPort): Promise<AuthUser> {
  const token = bearerToken(req);
  if (!token) throw new ApiError('unauthenticated');
  const user = await auth.getUser(token);
  if (!user) throw new ApiError('unauthenticated');
  return user;
}

export async function optionalUser(req: Request, auth: AuthPort): Promise<AuthUser | null> {
  const token = bearerToken(req);
  return token ? await auth.getUser(token) : null;
}
