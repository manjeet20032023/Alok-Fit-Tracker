import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  envDir: '../..',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['alok-icon.svg'],
      manifest: {
        name: 'Alok Fit Tracker',
        short_name: 'Alok Fit',
        description: 'Offline-first workout, cardio, core and fitness tracking.',
        theme_color: '#18231e',
        background_color: '#f4f6f5',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/alok-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
})
