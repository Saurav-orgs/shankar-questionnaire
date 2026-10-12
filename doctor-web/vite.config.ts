import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5174 and 5175 are occupied by other apps on this machine.
    // strictPort keeps a collision loud instead of silently drifting ports,
    // which would break the API's CORS allowlist in a confusing way.
    port: 5176,
    strictPort: true,
    // Dev-only proxy, currently unused: src/lib/api.ts holds an absolute API
    // URL, so requests go straight there and never through this. Kept because
    // it is how you point the app at a local API — change that baseURL to
    // '/api' and the dev server forwards to localhost:4000.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
