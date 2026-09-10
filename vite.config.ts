import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import opponentMotion from './src/content/opponent-motion.json' with { type: 'json' };
import { projectDrillsPlugin } from './server/projectDrills';
import { projectShotsPlugin } from './server/projectShots';

export default defineConfig({
  plugins: [
    projectDrillsPlugin(),
    projectShotsPlugin(),
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
        // Keep the active 120 Hz library offline; retained review bundles are
        // evidence, not additional downloads required to start practice.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,glb,json,txt}'],
        globIgnores: ['assets/venues/**', 'assets/audience/**'],
        manifestTransforms: [async (entries) => ({
          manifest: entries.filter(({ url }) => !url.startsWith('assets/opponents/')
            || !url.endsWith('.glb') || url === opponentMotion.url.slice(1)),
          warnings: [],
        })],
        runtimeCaching: [{
          urlPattern: /\/assets\/venues\/(hard-open-arena|clay-sunset-arena|grass-center-court|timber-hall|clay-stadium|covered-grass-arena)\/\1(?:\.performance)?\.[a-f0-9]{12}\.glb$/,
          handler: 'CacheFirst',
          options: { cacheName: 'tenmulate-venues-v1', cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 12, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true } },
        }, {
          urlPattern: /\/assets\/venues\/(hard-open-arena|clay-sunset-arena|grass-center-court|timber-hall|clay-stadium|covered-grass-arena)\/manifest\.json$/,
          handler: 'NetworkFirst',
          options: { cacheName: 'tenmulate-venue-manifests-v1', networkTimeoutSeconds: 3,
            cacheableResponse: { statuses: [200] } },
        }, {
          urlPattern: /\/assets\/(?:audience\/spectators-(?:front|back)-(?:512|1024)\.webp|venues\/[a-z-]+\/audience-seats\.[a-f0-9]{12}\.json)$/,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'tenmulate-audience-v1', cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true } },
        }],
        cleanupOutdatedCaches: true,
        // Review queries select client-side state, not a different HTML shell.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^(camera|version|venue|quality|audience)$/],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/venue-review\.html/, /^\/__tenmulate\//],
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
