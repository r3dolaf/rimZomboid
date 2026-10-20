import { expect, test } from '@playwright/test';

interface Debug {
  world: {
    tick: number;
    nextStrangerAt: number;
    stranger: unknown;
    survivors: { id: number; bubble: unknown }[];
  };
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

  // Que llegue ya.
  await page.evaluate(() => {
    const { world } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    world.nextStrangerAt = world.tick;
  });
  const dialog = page.getByTestId('stranger');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('quiere unirse al grupo');
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);

  await page.getByTestId('stranger-accept').click();
  await expect(dialog).toBeHidden(); // enseguida, aunque esté en pausa
  await page.locator('[data-speed="1"]').click();
  await expect(cards).toHaveCount(4);

  await cards.last().click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Relaciones');
  await expect(sheet.locator('[data-testid="relation"]')).toHaveCount(3);
  expect(errores).toEqual([]);
});
