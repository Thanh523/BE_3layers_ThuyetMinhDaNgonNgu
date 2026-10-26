import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api/admin/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/dashboard': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/narrations': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/places': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/images': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/audios': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/qrs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/media-uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/qr': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/places': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/user/favorites': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/user/history': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/user/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/analytics': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
