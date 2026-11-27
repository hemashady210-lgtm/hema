// Entry point: wires real adapters. Logic lives in app.ts (tested with fakes in app_test.ts).
import { createApp } from './app.ts';
import { createAdminClient, supabaseAuth, supabaseDb } from '../_shared/db.ts';
import { createResendMailer } from '../_shared/email/resend.ts';
import { loadEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/log.ts';

const env = loadEnv();
const admin = createAdminClient(env);

Deno.serve(
  createApp({
    env,
    db: supabaseDb(admin),
    auth: supabaseAuth(admin),
    mailer: createResendMailer(env.resend),
    logger: createLogger({ fn: 'api' }),
  }),
);
