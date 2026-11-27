// Bundle budgets (DESIGN_SYSTEM §15, decision H5). Run after `vite build`:
//   pnpm --filter dashboard bundle:check
// Measures gzip sizes from dist/.vite/manifest.json: the JS a first visit downloads for key
// routes (entry + the route's static import graph), the lazy effects/WebGL chunks, and CSS.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'));
const gz = (file) => gzipSync(readFileSync(join(dist, file)), { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

/** Static import closure of a manifest entry (JS files + CSS files). */
function closure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const dep of manifest[key]?.imports ?? []) closure(dep, seen);
  return seen;
}
const files = (keys, field) =>
  new Set(
    [...keys].flatMap((k) => (field === 'css' ? (manifest[k]?.css ?? []) : [manifest[k].file])),
  );
const size = (set) => [...set].reduce((sum, f) => sum + gz(f), 0);

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const entry = closure(entryKey);
// [modules that a first visit to the route loads, first-visit JS budget in kB]. Budgets are the
// measured size after route splitting plus ~4 % headroom: react-dom, react-router, supabase-js,
// zod, i18next and tailwind-merge set the floor (before splitting every route was 332.8 kB).
const routes = {
  'sign-in': [['src/features/auth/SignInPage.tsx'], 315],
  'sign-up': [['src/features/auth/SignUpPage.tsx'], 315],
  'create workspace': [['src/features/workspaces/CreateWorkspacePage.tsx'], 320],
  'workspace overview': [
    ['src/features/workspaces/WorkspaceLayout.tsx', 'src/features/overview/OverviewPage.tsx'],
    320,
  ],
  members: [
    [
      'src/features/workspaces/WorkspaceLayout.tsx',
      'src/features/settings/SettingsLayout.tsx',
      'src/features/members/MembersPage.tsx',
    ],
    340,
  ],
};

const budgets = { css: 16 * 1024, effects: 45 * 1024, webgl: 260 * 1024 };
const rows = [];
const failures = [];
for (const [name, [mods, budgetKb]] of Object.entries(routes)) {
  const keys = new Set(entry);
  for (const m of mods) {
    if (!manifest[m]) throw new Error(`bundle-check: ${m} is not a chunk entry in the manifest`);
    closure(m, keys);
  }
  const js = size(files(keys, 'js'));
  const css = size(files(keys, 'css'));
  if (js > budgetKb * 1024) failures.push(`first visit ${name}: ${kb(js)} > ${budgetKb} kB`);
  rows.push([`first visit: ${name}`, js, css]);
}

// Lazy decorative chunks: everything reachable from the effect modules that the entry does not
// already include.
const minus = (a, b) => new Set([...a].filter((x) => !b.has(x)));
const webglKey = 'src/components/effects/brand-scene-3d.tsx';
const webgl = manifest[webglKey] ? size(files(minus(closure(webglKey), entry), 'js')) : 0;
// The desktop brand panel (effects + beams + CSS poster) is a lazy chunk on top of sign-in.
const panelKey = 'src/features/auth/BrandPanel.tsx';
const signInSet = closure('src/features/auth/SignInPage.tsx', new Set(entry));
const effects = manifest[panelKey]
  ? size(files(minus(minus(closure(panelKey), signInSet), closure(webglKey)), 'js'))
  : 0;
const totalCss = size(files(new Set(Object.keys(manifest)), 'css'));

console.log('\nBundle (gzip, level 9)\n');
for (const [name, js, css] of rows)
  console.log(`  ${name.padEnd(30)} JS ${kb(js).padStart(9)}   CSS ${kb(css).padStart(8)}`);
console.log(`  ${'brand panel + effects (lazy)'.padEnd(30)} JS ${kb(effects).padStart(9)}`);
console.log(`  ${'WebGL scene (lazy, desktop)'.padEnd(30)} JS ${kb(webgl).padStart(9)}`);
console.log(`  ${'all CSS'.padEnd(30)}              CSS ${kb(totalCss).padStart(8)}\n`);

if (totalCss > budgets.css) failures.push(`CSS ${kb(totalCss)} > ${kb(budgets.css)}`);
if (effects > budgets.effects) failures.push(`brand panel ${kb(effects)} > ${kb(budgets.effects)}`);
if (webgl > budgets.webgl) failures.push(`WebGL ${kb(webgl)} > ${kb(budgets.webgl)}`);
if (failures.length) {
  console.error(`Over budget:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('Within budget.');
