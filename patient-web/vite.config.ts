import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5178,
    strictPort: true,
    // Same-origin `/api` for local browser checks: set VITE_API_BASE_URL=/api
    // and the dev server forwards to the API, so the API's CORS allowlist can
    // stay pointed at the dev tunnel. Dev only — production builds never use
    // this.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
