import { expect, test } from '@playwright/test';

test('el juego carga sin errores y responde a la velocidad', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));

  await page.goto('/?seed=4242');
  await expect(page.locator('canvas')).toBeVisible();
  // H6c: la semilla, en el panel Partida; y a 1280 px la barra de arriba cabe entera.
  await page.getByTestId('hud-game').click();
  await expect(page.getByTestId('game-seed')).toHaveText('Semilla: 4242');
  await page.getByTestId('hud-game').click();
  await page.setViewportSize({ width: 1280, height: 720 });
  const overflow = await page.evaluate(() => {
    const bar =
      document.querySelector('.hud-bar') ??
      document.querySelector('[data-testid="hud-time"]')!.parentElement!;
    return bar.scrollWidth - bar.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);

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
