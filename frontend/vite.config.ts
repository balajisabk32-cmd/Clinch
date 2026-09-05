import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs on 8000. Proxying keeps the frontend origin-clean and means
    // no CORS surprises when we demo from another device on the LAN.
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } },
  },
})
