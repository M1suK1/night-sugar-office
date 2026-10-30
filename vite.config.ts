import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cardsApiPlugin } from './scripts/cards-api.mjs';

export default defineConfig({
  plugins: [react(), cardsApiPlugin()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react')) return 'react';
          return 'vendor';
        },
      },
    },
  },
});

