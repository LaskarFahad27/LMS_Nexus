import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isCraftx = mode === 'craftx'
  const base = env.VITE_BASE || (isCraftx ? '/lms/' : '/')

  return {
    plugins: [react(), tailwindcss()],
    base,
    build: {
      outDir: isCraftx ? 'dist-craftx' : 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:5000',
        '/uploads': 'http://localhost:5000',
      },
    },
  }
})
