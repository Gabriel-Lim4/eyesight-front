import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O rewrite de SPA do Render entrega um arquivo vazio nas rotas internas (tela
// branca ao voltar do OAuth ou ao dar F5). Arquivos reais têm prioridade sobre o
// rewrite, então cada rota do App.jsx ganha sua cópia do index.html.
// Caminhos com "/" são de topo; os demais são filhos de /app.
export function rotasDoApp(source) {
  const paths = [...source.matchAll(/\bpath="([^"]+)"/g)].map(match => match[1])
  return paths
    .filter(path => path !== '/' && !path.includes('*') && !path.includes(':'))
    .map(path => (path.startsWith('/') ? path.slice(1) : `app/${path}`))
}

function copiarIndexParaRotas() {
  let root, outDir
  return {
    name: 'copiar-index-para-rotas',
    apply: 'build',
    configResolved(config) { root = config.root; outDir = resolve(root, config.build.outDir) },
    closeBundle() {
      const rotas = rotasDoApp(readFileSync(resolve(root, 'src/App.jsx'), 'utf8'))
      for (const rota of rotas) {
        mkdirSync(resolve(outDir, rota), { recursive: true })
        copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, rota, 'index.html'))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copiarIndexParaRotas()],
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
