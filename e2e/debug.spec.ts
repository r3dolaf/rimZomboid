import { expect, test } from '@playwright/test';

// H6c: F3 abre el modo depuración; sus trampas funcionan (dar cosas, pasar 1 hora).

test('F3: el panel de depuración con sus trampas', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/?seed=5');
  await page.locator('[data-speed="0"]').click();
  await page.keyboard.press('F3');
  await expect(page.getByTestId('debug-panel')).toBeVisible();
  await expect(page.getByTestId('debug-counts')).toContainText('colonos');
  const food = async () =>
    Number((await page.getByTestId('hud-food').textContent())?.match(/\d+/)?.[0]);
  const before = await food();
  await page.getByTestId('debug-give').click();
  await page.locator('[data-speed="1"]').click();
  await expect.poll(food).toBeGreaterThanOrEqual(before + 9);
  await page.locator('[data-speed="0"]').click();
  const clock = () => page.getByTestId('hud-time').textContent();
  const t0 = await clock();
  await page.getByTestId('debug-hour').click();
  await expect.poll(clock).not.toBe(t0);
  await page.keyboard.press('F3');
  await expect(page.getByTestId('debug-panel')).toBeHidden();
  expect(errores).toEqual([]);
});
