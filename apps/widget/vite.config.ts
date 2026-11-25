import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// Base config only. Builds a single self-contained IIFE (`widget.js`) served from the
// Cloudflare CDN. Entry `src/main.ts` is created in Phase 03.
export default defineConfig({
  plugins: [preact()],
  envPrefix: 'VITE_',
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    lib: {
      entry: 'src/main.ts',
      name: 'AiCrmWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
  },
});
