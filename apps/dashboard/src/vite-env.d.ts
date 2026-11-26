/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WIDGET_CDN_URL: string;
  readonly VITE_PAYPAL_CLIENT_ID: string;
  readonly VITE_AUTH_GOOGLE_ENABLED: 'true' | 'false';
  readonly VITE_APP_ENV: 'local' | 'staging' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
