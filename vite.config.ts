import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'app',
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(import.meta.dirname, 'shared') } },
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 700 },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001', '/photos': 'http://localhost:3001' },
  },
});
