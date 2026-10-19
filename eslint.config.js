import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', '.superpowers/'] },
  ...tseslint.configs.recommended,
  {
    // La simulación no puede depender de la pantalla, del navegador ni del azar sin semilla.
    files: ['src/sim/**/*.ts'],
    ignores: ['src/sim/**/*.test.ts', 'src/sim/testing/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['phaser'],
          patterns: [
            { group: ['phaser/*'], message: 'La simulación no usa Phaser.' },
            {
              group: ['**/render/**', '**/ui/**', '**/game/**'],
              message: 'La simulación no depende de la pantalla.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'Date',
        'performance',
        'process',
        'globalThis',
        'self',
        'navigator',
        'localStorage',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Usa src/sim/rng.ts' },
        {
          object: 'Math',
          property: 'hypot',
          message: 'Usa Math.sqrt: hypot varía entre navegadores',
        },
      ],
    },
  },
);
