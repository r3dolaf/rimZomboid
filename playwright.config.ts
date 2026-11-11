import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  // I1: las pruebas están escritas en español: el navegador, en español (la del inglés lo pide).
  use: { baseURL: 'http://localhost:4173', locale: 'es-ES' },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // En la nube se usa el Chromium preinstalado; en local, el de Playwright.
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
      },
    },
  ],
});
