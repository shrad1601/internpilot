import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toLocaleString('en-SG', { hour12: false })),
  },
  build: {
    minify: false,
    sourcemap: true,
  },
})
