import { expect, test } from '@playwright/test';

interface Debug {
  forceEvent(id: string): boolean;
}

test('llega un desconocido: el juego se pausa, Aceptar añade una tarjeta; la ficha muestra Relaciones', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=4242&debug=1');
  const cards = page.locator('[data-testid^="card-"]');
  await expect(cards).toHaveCount(3);

  // Que llegue ya (con esta semilla, uno solo).
  await page.evaluate(() =>
    (window as unknown as { rimzomboid: Debug }).rimzomboid.forceEvent('strangers'),
  );
  const notice = page.getByTestId('decision-stranger');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('quiere unirse al grupo');
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);

  await notice.getByTestId('decision-option-0').click();
  await expect(notice).toBeHidden(); // enseguida, aunque esté en pausa
  await page.locator('[data-speed="1"]').click();
  await expect(cards).not.toHaveCount(3);

  await cards.last().click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Relaciones');
  expect(errores).toEqual([]);
});
