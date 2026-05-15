import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(() => {
  const gatewayProxyTarget = process.env.VITE_GATEWAY_PROXY_TARGET || 'http://localhost:3333'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: gatewayProxyTarget,
          changeOrigin: true,
        },
        '/loki': {
          target: 'http://localhost:3100',
          changeOrigin: true,
        },
        '/jaeger': {
          target: 'http://localhost:30686',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jaeger/, ''),
        },
      },
    },
  }
})
