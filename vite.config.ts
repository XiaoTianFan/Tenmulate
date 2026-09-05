import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'Tenmulate Tennis Rehearsal',
        short_name: 'Tenmulate',
        description: 'First-person tennis timing, rhythm, and tactical visualization.',
        theme_color: '#080c0f',
        background_color: '#080c0f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,glb,json,txt}'],
        globIgnores: ['assets/venues/**'],
        runtimeCaching: [{
          urlPattern: /\/assets\/venues\/(hard-open-arena|clay-sunset-arena|grass-center-court)\/\1\.[a-f0-9]{12}\.glb$/,
          handler: 'CacheFirst',
          options: { cacheName: 'tenmulate-venues-v1', cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true } },
        }, {
          urlPattern: /\/assets\/venues\/(hard-open-arena|clay-sunset-arena|grass-center-court)\/manifest\.json$/,
          handler: 'NetworkFirst',
          options: { cacheName: 'tenmulate-venue-manifests-v1', networkTimeoutSeconds: 3,
            cacheableResponse: { statuses: [200] } },
        }],
        cleanupOutdatedCaches: true,
        // Review queries select client-side state, not a different HTML shell.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^(camera|version|venue)$/],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/venue-review\.html/],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    rolldownOptions: { input: { app: 'index.html', venueReview: 'venue-review.html' } },
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 550,
  },
});
