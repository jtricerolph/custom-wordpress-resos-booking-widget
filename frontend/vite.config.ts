import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Single JS + CSS file (no code splitting)
        manualChunks: undefined,
        entryFileNames: 'assets/rbw-widget.js',
        chunkFileNames: 'assets/rbw-widget.js',
        assetFileNames: 'assets/rbw-widget.[ext]',
      },
    },
  },
  define: {
    'process.env': {},
  },
})
