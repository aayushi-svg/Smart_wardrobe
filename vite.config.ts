import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Vite rejects unknown Host headers; allow ngrok tunnel domains through.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
