import { expect, test } from '@playwright/test';

// I1: el juego en inglés: la portada y la partida en inglés (con ?lang=en), sin errores; cambiar a
// español en plena partida la guarda y sigue con ella en español.
test('en inglés desde la portada, jugar un rato y cambiar a español en plena partida', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?lang=en&debug=1');
  const start = page.getByTestId('start');
  await expect(start).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(start).toContainText('Choose a start');
  await expect(page.getByTestId('start-objective')).toContainText('find a radio');
  await expect(page.getByTestId('lang-en')).toHaveClass(/selected/);
  await page.getByTestId('start-seed').fill('31');
  await page.getByTestId('start-go').click();
  await expect(start).toBeHidden();
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(3);
  await expect(page.getByTestId('hud-time')).toContainText('Day 1');
  await page.locator('[data-speed="3"]').click();
  await page.waitForTimeout(4000);
  await page.locator('[data-speed="0"]').click();
  // Cambiar a español en plena partida: se guarda y se sigue la misma.
  await page.getByTestId('hud-game').click();
  await expect(page.getByTestId('game-panel')).toContainText('Save now');
  await page.getByTestId('lang-es').click();
  await page.waitForURL(/load=1/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(3);
  await expect(page.getByTestId('hud-time')).toContainText('Día 1');
  expect(errores).toEqual([]);
});
