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
  },
})
