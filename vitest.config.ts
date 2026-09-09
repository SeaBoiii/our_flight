import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    // Node 25+ exposes native Web Storage, which would shadow jsdom's
    // per-test browser storage. Keep storage semantics owned by jsdom.
    execArgv: Number(process.versions.node.split('.')[0]) >= 25 ? ['--no-experimental-webstorage'] : [],
    setupFiles: ['./src/test/setup.ts'],
  },
});
