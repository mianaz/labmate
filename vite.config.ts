import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  server: {
    // Tauri expects a fixed port; fail if that port is not available
    port: 5173,
    strictPort: true,
    // Mobile dev requires the host to be set
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 5174 } : undefined,
  },

  // Produce sourcemaps for Tauri debug builds
  build: {
    // Tauri uses Chromium on Windows / WebKit on macOS+Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
    // Debug builds should have sourcemaps
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
