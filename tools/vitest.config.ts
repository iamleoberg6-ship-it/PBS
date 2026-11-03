// Ferramentas de balanceamento (lentas): rodam só com `npm run balance`.
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tools/**/*.test.ts'], testTimeout: 300_000 } });
