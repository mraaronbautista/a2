import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: { port: 5174 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Push needs custom service-worker logic (push/notificationclick
      // handlers) that generateSW's auto-authored worker has no hook for —
      // injectManifest lets src/sw.ts own the whole file, with the
      // precache manifest spliced in at build time.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      manifest: {
        name: 'A²',
        short_name: 'A²',
        description: 'Shared course, task, and note tracker for two law students.',
        theme_color: '#1b2436',
        background_color: '#faf7f2',
        display: 'standalone',
        icons: [
          { src: '/icons.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
