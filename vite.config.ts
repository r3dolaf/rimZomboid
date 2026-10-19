import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas para que funcione en GitHub Pages (subcarpeta /rimzomboid/).
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
