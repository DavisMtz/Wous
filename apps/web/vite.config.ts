import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, Vite sirve la web y reenvía la API y el WebSocket al Worker
// local: mismo origen para el navegador, así la cookie HttpOnly funciona sin CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
      '/ws': { target: 'ws://localhost:8787', ws: true, changeOrigin: false },
    },
  },
  // Phaser entra por import dinámico (/plaza): sin esto Vite lo descubre tarde
  // y recarga la página a media partida en desarrollo.
  optimizeDeps: { include: ['phaser'] },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Phaser es un solo bloque de ~1.2 MB (min): va en su propio chunk perezoso.
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/phaser/') ? 'phaser' : undefined),
      },
    },
  },
});
