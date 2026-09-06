import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/proceso-pwa/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Los iconos viven en public/ y se copian tal cual. Antes se pedían
      // 'favicon.ico' y 'apple-touch-icon.png', que no existían en el proyecto.
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'IMPREDIMEX — Ingeniería de Procesos',
        short_name: 'Procesos',
        description: '5S, checklists, evaluaciones, Gantt y layout de planta — IMPREDIMEX',
        lang: 'es-MX',
        // Colores de la paleta de la suite.
        theme_color: '#003580',
        background_color: '#003580',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/proceso-pwa/',
        scope: '/proceso-pwa/',
        icons: [
          {
            // Archivo local. Antes apuntaba a placehold.co, un servicio de
            // imágenes de relleno: el icono instalado era un cuadro azul con la
            // palabra PROCESO, generado por un sitio ajeno.
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
