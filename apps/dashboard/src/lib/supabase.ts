import { createClient } from '@supabase/supabase-js';
import type { Database } from '@ai-crm/shared';
import { env } from './env';

// Browser client: publishable key only (RLS is the boundary). PKCE for email links and OAuth.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'ai-crm.auth',
  },
});
