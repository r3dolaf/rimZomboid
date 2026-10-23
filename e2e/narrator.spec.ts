import { expect, test } from '@playwright/test';

interface Debug {
  forceEvent(id: string): boolean;
}

const force = (id: string) =>
  (window as unknown as { rimzomboid: Debug }).rimzomboid.forceEvent(id);

test('portada: elegir Caótico y Empezar; la dirección lleva el narrador', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?debug=1');
  const start = page.getByTestId('start');
  await expect(start).toBeVisible();
  await page.getByTestId('narrator-chaotic').click();
  await page.getByTestId('start-seed').fill('4242');
  await page.getByTestId('start-go').click();
  await expect(start).toBeHidden();
  await expect(page).toHaveURL(/seed=4242/);
  await expect(page).toHaveURL(/narrador=caotico/);
  await expect(page.getByTestId('hud-narrator')).toHaveText('Narrador: Caótico');
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(3);
  expect(errores).toEqual([]);
});

test('un suceso malo deja un aviso rojo y pausa; una decisión se contesta con sus botones', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=4242&narrador=equilibrado&debug=1');
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(3);

  await page.evaluate(force, 'grief');
  const notice = page.getByTestId('notice').first();
  await expect(notice).toBeVisible();
  await expect(notice).toHaveClass(/bad/);
  await expect(notice).toContainText('Malos recuerdos');
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);
  // Pulsar el aviso abre la ficha del colono.
  await notice.click();
  await expect(page.getByTestId('sheet')).toBeVisible();
  await page.getByTestId('notice-close').first().click();
  await expect(page.getByTestId('notice')).toHaveCount(0);

  await page.locator('[data-speed="1"]').click();
  await page.evaluate(force, 'flu');
  const flu = page.getByTestId('decision-fever');
  await expect(flu).toBeVisible();
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);
  await flu.getByTestId('decision-option-0').click();
  await expect(flu).toBeHidden();
  await page.locator('[data-speed="1"]').click();
  await expect(page.getByTestId('log')).toContainText('guarda reposo');
  expect(errores).toEqual([]);
});
