import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['catcher-overarch-cruelness.ngrok-free.dev', '.ngrok-free.dev'],
    proxy: {
      // Mengarahkan semua request yang memiliki awal /api
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
