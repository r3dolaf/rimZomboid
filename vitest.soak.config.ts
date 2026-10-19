import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['soak/**/*.test.ts'] },
});
