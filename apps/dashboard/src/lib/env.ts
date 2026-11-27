// Browser configuration: only VITE_* publishable values (CLAUDE.md secrets rule).
function read(name: keyof ImportMetaEnv, fallback?: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is not set (see .env.example)`);
}

export const env = {
  supabaseUrl: read('VITE_SUPABASE_URL', 'http://127.0.0.1:54321'),
  // Publishable key (sb_publishable_…, decision F5); the env name is kept from §21 (E12).
  supabaseKey: read('VITE_SUPABASE_ANON_KEY', ''),
  apiBaseUrl: read('VITE_API_BASE_URL', 'http://127.0.0.1:54321/functions/v1/api').replace(
    /\/+$/,
    '',
  ),
  googleEnabled: import.meta.env.VITE_AUTH_GOOGLE_ENABLED === 'true',
  appEnv: (import.meta.env.VITE_APP_ENV as string | undefined) ?? 'local',
};
