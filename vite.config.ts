import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
    ws: false,
    watch: {
      ignored: [
        '**/data/**',
        '**/dist/**',
        '**/*.db',
        '**/*.db-*',
        '**/*.tar.gz',
        '**/node_modules/**',
        '**/sovereign_apps/**',
        '**/downloads/**',
        '**/wineprefix/**',
        '**/.active_port',
        '**/*.log',
        '**/.termux*',
        '**/FORENSIC_SYSTEMS_MANUAL.md',
        '**/infinite_sim_store.json',
        '**/dynamic_tools.json',
        '**/agents_manifest.json',
        '**/swarm-agent-models.json',
        '**/public/sw.js'
      ]
    }
  },
  optimizeDeps: {
    holdUntilCrawlEnd: true,
    include: [
      'react',
      'react-dom',
      'lucide-react',
      '@google/genai',
      'three',
      'recharts',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore'
    ]
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@google/genai')) {
              return 'vendor-genai';
            }
            return 'vendor';
          }
        }
      }
    }
  },
});
