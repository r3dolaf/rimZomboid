import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas para que funcione en GitHub Pages (subcarpeta /rimzomboid/).
  base: './',
  // Phaser ocupa ~1,3 MB por sí solo; no es un problema para este juego.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ['src/**/*.test.ts'],
    // Los tests que repiten un suceso cientos de veces tardan 1–3 s aquí y bastante más en
    // GitHub Actions; 20 s sigue cortando un test colgado.
    testTimeout: 20_000,
  },
});
