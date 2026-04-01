import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { renameSync, existsSync, readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Plugin to serve index.vite.html instead of index.html in dev mode,
// keeping the original monolithic index.html intact.
function viteHtmlEntry() {
  return {
    name: 'vite-html-entry',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/labmate/' || req.url === '/labmate/index.html') {
          req.url = '/labmate/index.vite.html';
        }
        next();
      });
    },
    // Rename dist/index.vite.html → dist/index.html after build
    closeBundle() {
      const src = resolve(__dirname, 'dist/index.vite.html');
      const dst = resolve(__dirname, 'dist/index.html');
      if (existsSync(src)) {
        renameSync(src, dst);
      }
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || '/labmate/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    viteHtmlEntry(),
    tailwindcss(),
    react(),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.vite.html'),
    },
  },
});
