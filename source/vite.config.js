import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For GitHub Pages, set base to '/REPO_NAME/' if hosted at username.github.io/REPO_NAME/
// Use '/' for root domain (CNAME) or username.github.io
export default defineConfig({
  plugins: [react()],
  base: './', // relative paths so it works at any URL
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
