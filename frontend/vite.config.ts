import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // IIFE wraps everything in a self-executing function to avoid
        // global scope pollution (prevents conflicts with jQuery $ on WordPress)
        format: 'iife',
        entryFileNames: 'assets/rbw-widget.js',
        assetFileNames: 'assets/rbw-widget.[ext]',
      },
    },
  },
  define: {
    'process.env': {},
  },
})
