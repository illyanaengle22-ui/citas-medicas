import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  build: {
    sourcemap: false,
  },
  server: {
    watch: {
      usePolling: true,
    },
    // Desarrollo: el frontend llama a rutas relativas (/api, /uploads) y
    // Vite las reenvía al backend local. Así el mismo build sirve para
    // producción (nginx) sin recompilar con una URL absoluta.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})