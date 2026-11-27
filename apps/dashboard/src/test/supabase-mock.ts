// In-memory stand-in for the supabase-js client used by component tests.
import { vi } from 'vitest';

type Listener = (event: string, session: unknown) => void;

export interface QueryCall {
  table: string;
  op: string;
  args: unknown[];
}

export function createSupabaseMock() {
  let session: unknown = null;
  const listeners = new Set<Listener>();
  const calls: QueryCall[] = [];
  const tableData: Record<string, unknown> = {};
  /** Per-table / per-RPC errors, to test failure states (cleared by `reset()`). */
  const tableErrors: Record<string, unknown> = {};
  const rpcErrors: Record<string, unknown> = {};

  function builder(table: string) {
    const result = () =>
      tableErrors[table]
        ? { data: null, error: tableErrors[table] }
        : { data: tableData[table] ?? null, error: null };
    const chain: Record<string, unknown> = {};
    for (const op of [
      'select',
      'update',
      'insert',
      'delete',
      'eq',
      'in',
      'is',
      'order',
      'limit',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
    ]) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return chain;
      };
    }
    const one = () => {
      const r = result();
      return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
    };
    chain.maybeSingle = () => Promise.resolve(one());
    chain.single = () => Promise.resolve(one());
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    return chain;
  }

  const auth = {
    getSession: vi.fn(() => Promise.resolve({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
    signInWithPassword: vi.fn(() =>
      Promise.resolve({ data: { session: null, user: null }, error: null }),
    ),
    signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signUp: vi.fn(() =>
      Promise.resolve({ data: { session: null, user: { id: 'u1' } }, error: null }),
    ),
    resend: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    resetPasswordForEmail: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signOut: vi.fn(() => {
      session = null;
      listeners.forEach((l) => l('SIGNED_OUT', null));
      return Promise.resolve({ error: null });
    }),
  };

  const rpcData: Record<string, unknown> = {};
  return {
    client: {
      auth,
      from: vi.fn((t: string) => builder(t)),
      rpc: vi.fn((fn: string) =>
        Promise.resolve(
          rpcErrors[fn]
            ? { data: null, error: rpcErrors[fn] }
            : { data: rpcData[fn] ?? null, error: null },
        ),
      ),
    },
    rpcData,
    calls,
    tableData,
    tableErrors,
    rpcErrors,
    /** Forget simulated errors (data stays; tests set what they need). */
    resetErrors() {
      for (const k of Object.keys(tableErrors)) delete tableErrors[k];
      for (const k of Object.keys(rpcErrors)) delete rpcErrors[k];
    },
    setSession(next: unknown) {
      session = next;
      listeners.forEach((l) => l(next ? 'SIGNED_IN' : 'SIGNED_OUT', next));
    },
  };
}

export const supabaseMock = createSupabaseMock();
