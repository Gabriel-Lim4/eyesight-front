import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    testTimeout: 15000,
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
  build: {
    // Code splitting por vendor
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor';
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('react-icons') || id.includes('lucide-react')) {
              return 'icons';
            }
          }
        },
      },
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    open: true,
  },
})
