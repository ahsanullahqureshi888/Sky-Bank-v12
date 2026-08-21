import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    // Respect the port provided by the hosting environment (preview/sandbox),
    // falling back to Vite's default for local development.
    port: Number(process.env.PORT || process.env.DEV_PORT || 5173),
    host: true,
    proxy: {
      '/api': {
        // Use the deployed API by default so the Vite preview works without a local FastAPI process.
        target: process.env.VITE_BACKEND_TARGET || 'https://sky-banking-backend.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
