import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs on 8200. Proxying keeps the frontend origin-clean and means
    // no CORS surprises when we demo from another device on the LAN.
    //
    // 8200 rather than the usual 8000 because port 8000 on this machine is held
    // by a ZOMBIE SOCKET: the owning process has exited but Windows has not
    // released the binding, so a new server cannot bind it and anything already
    // listening there answers with stale code. A reboot clears it; until then
    // pointing at 8000 silently serves the old catalogue.
    proxy: { '/api': { target: 'http://localhost:8200', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } },
  },
})
