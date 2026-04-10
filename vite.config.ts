import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files; process.env has Docker / shell env vars
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const rawHosts = process.env.VITE_ALLOWED_HOSTS || fileEnv.VITE_ALLOWED_HOSTS || ''
  const allowedHosts = rawHosts === 'all'
    ? true
    : rawHosts.split(',').map((h) => h.trim()).filter(Boolean)

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3001,
      allowedHosts,
      hmr: {
        protocol: 'wss',
        clientPort: 443,
      },
      proxy: {
        '/api': {
          target: 'http://backend:8080',
          changeOrigin: true,
        },
        '/actuator': {
          target: 'http://backend:8080',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 3001,
      allowedHosts,
    },
  }
})
