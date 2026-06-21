import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  // SWC compiles TS with legacy decorators + decorator metadata so NestJS DI works under vitest.
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 240_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
