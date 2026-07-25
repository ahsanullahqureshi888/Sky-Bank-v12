import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Respect the port provided by the hosting environment (preview/sandbox),
    // falling back to Vite's default for local development.
    port: Number(process.env.PORT || process.env.DEV_PORT || 5173),
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
