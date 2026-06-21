import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // embedded-postgres first run downloads a binary + runs initdb; be generous.
    testTimeout: 120_000,
    hookTimeout: 240_000,
    pool: 'forks',
    // One embedded Postgres instance per file; don't run files in parallel (port reuse).
    fileParallelism: false,
  },
});
