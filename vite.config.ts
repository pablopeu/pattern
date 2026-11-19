import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: process.env.BASE_PATH || './', build:{rollupOptions:{output:{manualChunks(id){if(id.includes('/node_modules/paper/'))return 'geometry';if(id.includes('/node_modules/clipper-lib/'))return 'clipping';if(id.includes('/node_modules/zod/'))return 'schema';if(/node_modules\/(react|react-dom|scheduler)\//.test(id))return 'interface';}}}}, test: { include: ['src/**/*.test.ts'], environment: 'node' } });
