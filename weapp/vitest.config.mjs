import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{js,cjs,mjs}'],
    setupFiles: ['./test/helpers/setup.cjs'],
    pool: 'forks',
    globals: true,
    testTimeout: 20000,
  },
});
