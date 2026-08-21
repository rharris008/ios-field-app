import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ios-field-app/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['ios-logo.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'IOS Field App',
        short_name: 'IOS Field',
        description: 'IOS Integrated Outsourced Services — Field merchandising app for reps',
        theme_color: '#1A2B4A',
        background_color: '#1A2B4A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/ios-field-app/',
        start_url: '/ios-field-app/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': '/src' } },
})
