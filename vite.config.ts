import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas para que funcione en GitHub Pages (subcarpeta /rimzomboid/).
  base: './',
  // Phaser ocupa ~1,3 MB por sí solo; no es un problema para este juego.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
