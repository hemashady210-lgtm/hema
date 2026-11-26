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

  function builder(table: string) {
    const result = () => ({ data: tableData[table] ?? null, error: null });
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
    ]) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return chain;
      };
    }
    chain.maybeSingle = () => Promise.resolve(result());
    chain.single = () => Promise.resolve(result());
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

  return {
    client: { auth, from: vi.fn((t: string) => builder(t)) },
    calls,
    tableData,
    setSession(next: unknown) {
      session = next;
      listeners.forEach((l) => l(next ? 'SIGNED_IN' : 'SIGNED_OUT', next));
    },
  };
}

export const supabaseMock = createSupabaseMock();
