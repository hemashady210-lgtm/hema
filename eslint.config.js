// Root ESLint flat config.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import localPlugin from './eslint-rules/logical-css.js';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'supabase/.temp/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // Vendored agent skills (third-party scripts).
      '.claude/skills/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, local: localPlugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // DESIGN_SYSTEM §10.2: logical utilities only (ms-/me-, ps-/pe-, start-/end-…).
      'local/logical-css': 'error',
    },
  },
  {
    // Node tooling: DB runners, ESLint rules, Playwright config/specs, Vite configs.
    files: [
      'scripts/**/*.{js,mjs}',
      'apps/*/scripts/**/*.{js,mjs}',
      'eslint-rules/**/*.js',
      '**/playwright.config.ts',
      '**/vite.config.ts',
      'apps/*/e2e/**/*.ts',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node },
    },
  },
  {
    // Edge functions run on Deno; they are checked with `deno lint` / `deno check` (CI job `deno`).
    ignores: ['supabase/functions/**'],
  },
);
