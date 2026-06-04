import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// base '/Critical6/' for the GitHub Pages build (served at /<repo>/); '/' in dev.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Critical6/' : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
}));
