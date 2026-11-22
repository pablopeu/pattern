import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || './',
  server: {
    // Backend PHP de publicaciones (desarrollo y E2E). En producción sirve Apache/PHP.
    proxy: {
      // Anclados: '/s' a secas capturaría '/src' y '/site.webmanifest'.
      '^/api/': process.env.PATTERN_PHP || 'http://127.0.0.1:8180',
      '^/api$': process.env.PATTERN_PHP || 'http://127.0.0.1:8180',
      '^/s/': process.env.PATTERN_PHP || 'http://127.0.0.1:8180',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/paper/')) return 'geometry';
          if (id.includes('/node_modules/clipper-lib/')) return 'clipping';
          if (id.includes('/node_modules/zod/')) return 'schema';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'interface';
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
