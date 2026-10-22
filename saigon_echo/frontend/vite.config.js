import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/admin/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin/dashboard': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/user/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
