import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { renameSync, existsSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from 'fs';

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
    // Rename dist/index.vite.html → dist/index.html after build, and inject the
    // list of built JS/CSS chunks into the service worker's precache list.
    closeBundle() {
      const src = resolve(__dirname, 'dist/index.vite.html');
      const dst = resolve(__dirname, 'dist/index.html');
      if (existsSync(src)) {
        renameSync(src, dst);
      }
      // Ship the recipe library with the build. The app fetches BASE_URL/recipes.json
      // and the service worker precaches it; the old deploy copied it server-side,
      // the hardened rsync+promote deploy only ships dist/, so make dist complete.
      const recipesSrc = resolve(__dirname, 'recipes.json');
      if (existsSync(recipesSrc)) {
        copyFileSync(recipesSrc, resolve(__dirname, 'dist/recipes.json'));
      }
      const swPath = resolve(__dirname, 'dist/sw.js');
      const assetsDir = resolve(__dirname, 'dist/assets');
      if (existsSync(swPath) && existsSync(assetsDir)) {
        const assets = readdirSync(assetsDir)
          .filter((f) => /\.(js|css)$/.test(f))
          .sort()
          .map((f) => './assets/' + f);
        const sw = readFileSync(swPath, 'utf-8');
        const marker = '/*__PRECACHE_ASSETS__*/[]';
        if (sw.includes(marker)) {
          writeFileSync(swPath, sw.replace(marker, JSON.stringify(assets)));
        }
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
      output: {
        // Function form: the object form only matched the bare package entry, so
        // `react-dom/client` (and with it ~500 KB of react-dom source) landed in
        // the app chunk and was re-downloaded on every deploy.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'react-vendor';
          if (id.includes('node_modules/dexie/')) return 'dexie';
          return undefined;
        },
      },
    },
  },
});
