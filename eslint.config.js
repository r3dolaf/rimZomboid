import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', '.superpowers/'] },
  ...tseslint.configs.recommended,
  {
    // La simulación no puede depender de la pantalla ni del azar sin semilla.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: ['phaser'], patterns: ['phaser/*'] }],
      'no-restricted-globals': ['error', 'window', 'document'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Usa src/sim/rng.ts' },
      ],
    },
  },
);
