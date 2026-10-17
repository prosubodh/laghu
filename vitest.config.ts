import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.global.ts'],
      reporter: ['text', 'json-summary', 'json'],
    },
  },
});
