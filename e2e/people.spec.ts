import { expect, test } from '@playwright/test';

test('tarjetas, ficha del superviviente y comida', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });

  await page.goto('/?seed=4242');
  const cards = page.locator('[data-testid^="card-"]');
  await expect(cards).toHaveCount(3);
  await expect(page.getByTestId('hud-food')).toHaveText('Comida: 35');

  const sheet = page.getByTestId('sheet');
  await expect(sheet).toBeHidden();
  const name = (await cards.first().locator('.name').textContent())!;
  await cards.first().click();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('h2')).toHaveText(name);
  await expect(sheet).toContainText('Rasgos');

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  expect(errores).toEqual([]);
});
