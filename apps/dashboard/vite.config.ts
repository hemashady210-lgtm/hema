/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
// Product name lives only in packages/shared/src/brand.ts (decision C11).
import { BRAND } from '../../packages/shared/src/brand.ts';

const brandHtml: Plugin = {
  name: 'brand-html',
  transformIndexHtml: (html) => html.replaceAll('%PRODUCT_NAME%', BRAND.productName),
};

export default defineConfig({
  plugins: [react(), tailwindcss(), brandHtml],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Only VITE_* variables are exposed to the browser. Never put secrets behind this prefix.
  envPrefix: 'VITE_',
  // manifest: read by scripts/bundle-check.mjs (budgets, DESIGN_SYSTEM §15).
  build: { target: 'es2022', sourcemap: true, manifest: true },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
