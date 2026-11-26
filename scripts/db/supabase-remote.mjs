#!/usr/bin/env node
// Apply migrations, run pgTAP suites and generate DB types against a hosted Supabase project
// through the Supabase Management API (HTTPS only; no direct Postgres connection needed).
//
//   node scripts/db/supabase-remote.mjs status
//   node scripts/db/supabase-remote.mjs migrate [--dry-run]
//   node scripts/db/supabase-remote.mjs test [file ...]
//   node scripts/db/supabase-remote.mjs types
//
// Env:
//   SUPABASE_ACCESS_TOKEN  personal access token (sbp_...). In a sandbox whose proxy injects the
//                          token, set it to the placeholder `proxy-injected`.
//   SUPABASE_PROJECT_REF   project ref; otherwise derived from SUPABASE_URL / supabase_link.
//   NODE_USE_ENV_PROXY=1   needed only when outbound HTTPS must go through HTTPS_PROXY.
//
// Endpoints used (Management API v1): POST /projects/{ref}/database/query and
// GET /projects/{ref}/types/typescript. Migration history is recorded in
// supabase_migrations.schema_migrations so the Supabase CLI sees the files as applied.
//
// Safety: every migration file runs in one transaction. Every test file runs inside a
// transaction that is always aborted at the end (fixtures never persist); a test file that
// contains COMMIT is refused.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const TESTS_DIR = join(ROOT, 'supabase/tests/database');
const TYPES_FILE = join(ROOT, 'packages/shared/src/database.types.ts');
const API = 'https://api.supabase.com/v1';
const TAP_MARKER = '__TAP_RESULTS__';

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const url = process.env.SUPABASE_URL || process.env.supabase_link;
  const match = url && /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url);
  if (!match) throw new Error('Set SUPABASE_PROJECT_REF (or SUPABASE_URL)');
  return match[1];
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
let ref;

async function api(path, init = {}) {
  if (!token) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN is required (use "proxy-injected" behind an injecting proxy)',
    );
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

/** Runs SQL; returns rows of the last statement or throws with the database error message. */
async function query(sql) {
  const res = await api(`/projects/${(ref ??= projectRef())}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const message =
      typeof res.body === 'string' ? res.body : (res.body?.message ?? JSON.stringify(res.body));
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.body;
}

const literal = (s) => `'${String(s).replaceAll("'", "''")}'`;

// --- SQL statement splitter (quotes, dollar quotes, comments) ---------------------------
export function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end + 1;
      buf += sql.slice(i, stop);
      i = stop;
    } else if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) j += 2;
        else if (sql[j] === ch) break;
        else j += 1;
      }
      buf += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? sql.length : end + tag[0].length;
        buf += sql.slice(i, stop);
        i = stop;
      } else {
        buf += ch;
        i += 1;
      }
    } else if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i += 1;
    } else {
      buf += ch;
      i += 1;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const stripComments = (stmt) =>
  stmt
    .replace(/^(\s*--[^\n]*\n)+/g, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//, '')
    .trim();

// --- commands ---------------------------------------------------------------------------
async function status() {
  const project = await api(`/projects/${(ref ??= projectRef())}`);
  if (!project.ok)
    throw new Error(`project lookup failed: ${project.status} ${JSON.stringify(project.body)}`);
  const { name, region, status: st, database } = project.body;
  console.log(JSON.stringify({ ref, name, region, status: st, database }, null, 2));
  const rows = await query(`
    select
      current_setting('server_version') as server_version,
      (select count(*) from pg_tables where schemaname = 'public') as public_tables,
      (select count(*) from pg_namespace where nspname = 'private') as private_schema,
      to_regclass('supabase_migrations.schema_migrations') is not null as has_migration_table,
      (select json_agg(json_build_object('name', name, 'default', default_version, 'installed', installed_version) order by name)
         from pg_available_extensions
        where name in ('vector','pgtap','pg_cron','pg_net','supabase_vault','pgsodium','pg_trgm','pgcrypto','pg_partman')) as extensions,
      (select json_agg(cfgname order by cfgname) from pg_ts_config) as ts_configs`);
  console.log(JSON.stringify(rows, null, 2));
}

async function appliedVersions() {
  await query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text);`);
  const rows = await query(
    'select version from supabase_migrations.schema_migrations order by version',
  );
  return new Set(rows.map((r) => r.version));
}

async function migrate({ dryRun }) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort();
  const applied = await appliedVersions();
  const pending = files.filter((f) => !applied.has(f.slice(0, 14)));
  console.log(`applied: ${applied.size}, pending: ${pending.length}`);
  for (const file of pending) {
    const version = file.slice(0, 14);
    const name = file.slice(15, -4);
    if (dryRun) {
      console.log(`would apply ${file}`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const record = `insert into supabase_migrations.schema_migrations (version, name, statements)
      values (${literal(version)}, ${literal(name)}, array[${literal(sql)}]);`;
    process.stdout.write(`applying ${file} ... `);
    try {
      await query(`begin;\n${sql}\n;\n${record}\ncommit;`);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      throw new Error(`${file}: ${err.message}`, { cause: err });
    }
  }
}

function instrumentTest(sql, file) {
  if (/\bcommit\b\s*;/i.test(sql.replace(/--[^\n]*/g, ''))) {
    throw new Error(`${file}: test files must not COMMIT`);
  }
  const statements = splitStatements(sql);
  const body = [];
  body.push('begin');
  body.push('create temp table __tap_out (n serial primary key, line text)');
  body.push('grant all on table __tap_out to public');
  body.push('grant all on sequence __tap_out_n_seq to public');
  for (const raw of statements) {
    const stmt = stripComments(raw);
    if (/^(begin|rollback|start transaction)\b/i.test(stmt)) continue;
    if (/^select\b/i.test(stmt)) {
      body.push(
        `insert into pg_temp.__tap_out (line) select t.line::text from (${stmt}) as t(line)`,
      );
    } else {
      body.push(raw);
    }
  }
  // Abort the whole transaction and hand the TAP output back in the error message.
  body.push(`do $tap$ begin
    raise exception '%', ${literal(TAP_MARKER)} || coalesce(
      (select string_agg(line, E'\\n' order by n) from pg_temp.__tap_out), '');
  end $tap$`);
  return body.join(';\n') + ';';
}

function parseTap(output) {
  const lines = output.split('\n');
  const planLine = lines.find((l) => /^1\.\.\d+$/.test(l));
  const planned = planLine ? Number(planLine.slice(3)) : null;
  const oks = lines.filter((l) => /^ok \d+/.test(l)).length;
  const notOks = lines.filter((l) => /^not ok \d+/.test(l));
  const passed = planned !== null && notOks.length === 0 && oks === planned;
  return { planned, oks, notOks, passed, lines };
}

async function test(files) {
  const list = files.length
    ? files.map((f) => resolve(f))
    : readdirSync(TESTS_DIR)
        .filter((f) => f.endsWith('.test.sql'))
        .sort()
        .map((f) => join(TESTS_DIR, f));
  let failed = 0;
  let total = 0;
  for (const file of list) {
    const sql = instrumentTest(readFileSync(file, 'utf8'), basename(file));
    let output;
    try {
      await query(sql);
      throw new Error('test transaction was not aborted (missing TAP marker)');
    } catch (err) {
      const idx = err.message.indexOf(TAP_MARKER);
      if (idx === -1) {
        failed += 1;
        console.log(`${basename(file)} .. ERROR\n  ${err.message}`);
        continue;
      }
      output = err.message.slice(idx + TAP_MARKER.length);
    }
    const r = parseTap(output);
    total += r.oks + r.notOks.length;
    if (r.passed) {
      console.log(`${basename(file)} .. ok (${r.oks})`);
    } else {
      failed += 1;
      console.log(
        `${basename(file)} .. FAILED (planned ${r.planned}, ok ${r.oks}, not ok ${r.notOks.length})`,
      );
      for (const l of r.lines.filter((x) => x.startsWith('not ok') || x.startsWith('#')))
        console.log(`  ${l}`);
    }
  }
  console.log(
    failed
      ? `FAIL: ${failed} file(s) failed, ${total} assertions run`
      : `PASS: ${list.length} files, ${total} assertions`,
  );
  if (failed) process.exitCode = 1;
}

async function types() {
  const res = await api(
    `/projects/${(ref ??= projectRef())}/types/typescript?included_schemas=public`,
  );
  if (!res.ok) throw new Error(`types failed: ${res.status} ${JSON.stringify(res.body)}`);
  const header =
    '// Generated from the Supabase dev project schema by `pnpm db:types:remote`.\n' +
    '// Do not edit by hand; regenerate after every migration.\n\n';
  writeFileSync(TYPES_FILE, header + res.body.types);
  console.log(`wrote ${TYPES_FILE}`);
}

const [cmd, ...args] = process.argv.slice(2);
const commands = {
  status: () => status(),
  migrate: () => migrate({ dryRun: args.includes('--dry-run') }),
  test: () => test(args.filter((a) => !a.startsWith('--'))),
  types: () => types(),
  // Prints the instrumented SQL for one test file (for checking the harness on local Postgres).
  instrument: async () =>
    console.log(instrumentTest(readFileSync(resolve(args[0]), 'utf8'), args[0])),
};
if (!commands[cmd]) {
  console.error(
    'usage: supabase-remote.mjs status | migrate [--dry-run] | test [files] | types | instrument <file>',
  );
  process.exit(2);
}
commands[cmd]().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
