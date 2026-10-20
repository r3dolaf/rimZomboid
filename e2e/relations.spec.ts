import { expect, test } from '@playwright/test';
import { STRANGER_FIRST_TICK } from '../src/sim/balance';

interface Debug {
  world: { tick: number; stranger: { survivors: unknown[] } | null };
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

  // En pausa y que lleguen ya. Llegan uno o dos según el azar: se cuenta lo que haya llegado.
  await page.locator('[data-speed="0"]').click();
  const arrived = await page.evaluate((first) => {
    const r = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    r.world.tick = first; // los desconocidos llegan a partir del día 3
    return r.forceEvent('strangers') ? r.world.stranger!.survivors.length : 0;
  }, STRANGER_FIRST_TICK);
  expect(arrived).toBeGreaterThan(0);
  const notice = page.getByTestId('decision-stranger');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('quiere unirse al grupo');
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);

  await notice.getByTestId('decision-option-0').click();
  await expect(notice).toBeHidden(); // enseguida, aunque esté en pausa
  await page.locator('[data-speed="1"]').click();
  await expect(cards).toHaveCount(3 + arrived);

  await cards.last().click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Relaciones');
  await expect(sheet.locator('[data-testid="relation"]')).toHaveCount(2 + arrived);
  expect(errores).toEqual([]);
});
