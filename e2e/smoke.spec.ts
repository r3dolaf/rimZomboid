import { expect, test } from '@playwright/test';

test('el juego carga sin errores y responde a la velocidad', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));

  await page.goto('/?seed=4242');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('hud-seed')).toHaveText('Semilla: 4242');

  const t0 = await page.getByTestId('hud-time').textContent();
  await page.locator('[data-speed="3"]').click();
  await expect(page.getByTestId('hud-time')).not.toHaveText(t0!, { timeout: 5000 });

  await page.keyboard.press('Space');
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);
  const t1 = await page.getByTestId('hud-time').textContent();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('hud-time')).toHaveText(t1!);

  expect(errores).toEqual([]);
});
