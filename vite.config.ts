import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Proceso PWA',
        short_name: 'proceso-pwa',
        description: 'Aplicacion PWA de gestion operativa y procesos',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'https://placehold.co/192x192/0284c7/ffffff.png?text=PROCESO',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://placehold.co/512x512/0284c7/ffffff.png?text=PROCESO',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
