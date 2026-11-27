export type Params = Record<string, string>;

export interface Route<C> {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: (ctx: C, params: Params) => Promise<Response>;
}

export function route<C>(method: string, path: string, handler: Route<C>['handler']): Route<C> {
  const keys: string[] = [];
  const source = path
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        keys.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { method, pattern: new RegExp(`^${source}/?$`), keys, handler };
}

export type Match<C> =
  | { kind: 'found'; route: Route<C>; params: Params }
  | { kind: 'method_not_allowed' }
  | { kind: 'not_found' };

export function match<C>(routes: Route<C>[], method: string, path: string): Match<C> {
  let pathMatched = false;
  for (const r of routes) {
    const m = r.pattern.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    const params: Params = {};
    try {
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
    } catch {
      return { kind: 'not_found' }; // malformed %-escape
    }
    return { kind: 'found', route: r, params };
  }
  return pathMatched ? { kind: 'method_not_allowed' } : { kind: 'not_found' };
}

/** Strips the function prefix: `/api/v1/x`, `/functions/v1/api/v1/x` → `/v1/x`. */
export function functionPath(pathname: string, functionName: string): string {
  const marker = `/${functionName}`;
  const i = pathname.indexOf(marker);
  if (i === -1) return pathname || '/';
  const rest = pathname.slice(i + marker.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}
