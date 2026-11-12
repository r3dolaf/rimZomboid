import { expect, test } from '@playwright/test';

// E1: el generador en el navegador: Construir → Generador (apagado sin uno en el almacén; con uno,
// el plano), encenderlo y apagarlo con el clic derecho y la base iluminada de noche, sin errores.
interface Debug {
  world: {
    blueprints: { kind: string }[];
    furniture: Record<string, unknown>[];
    common: { nextId: number };
    storage: { items: { generator: number } };
    base: { rect: { x: number; y: number; w: number; h: number } };
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  canPlace(kind: string, x: number, y: number): boolean;
  centerOnTile(x: number, y: number): void;
}

test('Construir → Generador, encenderlo y apagarlo y de noche, sin errores', async ({ page }) => {
  test.setTimeout(120_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=3&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();
  await page.keyboard.press('b');
  const gen = page.getByTestId('build-generator');
  await expect(gen).toBeDisabled();
  await expect(gen).toHaveAttribute('title', /hace falta un generador en el almacén/);
  await page.evaluate(() => {
    (window as unknown as { rimzomboid: Debug }).rimzomboid.world.storage.items.generator = 1;
  });
  await expect(gen).toBeEnabled();
  await page.keyboard.press('Escape');

  // Uno ya montado (con gasolina) en una casilla libre de la base, en el centro de la pantalla.
  const spot = await page.evaluate(async () => {
    const { world, tileToScreen, canPlace, centerOnTile } = (
      window as unknown as { rimzomboid: Debug }
    ).rimzomboid;
    const r = world.base.rect;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!canPlace('generator', x, y)) continue;
        world.furniture.push({
          id: world.common.nextId++,
          kind: 'generator',
          pos: { x, y },
          fuel: 20,
          on: true,
          powered: 0,
        });
        world.storage.items.generator = 0;
        centerOnTile(x, y);
        await new Promise((ok) => setTimeout(ok, 200));
        return tileToScreen(x, y);
      }
    return null;
  });
  expect(spot).not.toBeNull();
  await page.mouse.click(spot!.x, spot!.y, { button: 'right' });
  const sw = page.getByTestId('ctx-generatorSwitch');
  await expect(sw).toHaveText('⚡ Apagar el generador');
  await sw.click();
  await page.locator('[data-speed="1"]').click();
  await page.mouse.click(spot!.x, spot!.y, { button: 'right' });
  await expect(page.getByTestId('ctx-generatorSwitch')).toHaveText('⚡ Encender el generador');
  await page.getByTestId('ctx-generatorSwitch').click();

  // De noche, con la base iluminada.
  await page.keyboard.press('F3');
  for (let i = 0; i < 14; i++) await page.getByTestId('debug-hour').click();
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});
