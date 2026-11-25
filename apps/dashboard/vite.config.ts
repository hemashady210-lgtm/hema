import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Base config only. Entry (index.html / src/main.tsx) is created in Phase 02.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Only VITE_* variables are exposed to the browser. Never put secrets behind this prefix.
  envPrefix: 'VITE_',
  build: { target: 'es2022', sourcemap: true },
});
