import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = (env.VITE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3001,
      allowedHosts,
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
    },
  }
})
