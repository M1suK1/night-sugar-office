import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localApiPlugin } from './scripts/local-files.mjs';
import { staticCardsPlugin } from './scripts/static-cards.mjs';

export default defineConfig({
  // 本地接口（能读磁盘上的大卡）+ 静态卡库（构建时复制小卡，纯静态托管也能开局）
  plugins: [react(), localApiPlugin(), staticCardsPlugin()],
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

