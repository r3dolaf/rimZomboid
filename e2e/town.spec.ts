import { expect, test } from '@playwright/test';

// H4f: el pueblo — ir al supermercado, ver su ficha con el nombre y marcarlo para saquear.

interface Debug {
  world: {
    houses: { id: number; kind: string; rect: { x: number; y: number; w: number; h: number } }[];
    containers: { houseId: number; designated: boolean }[];
    grid: { width: number; height: number };
    town: { x: number; y: number; w: number; h: number };
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  centerOnTile(x: number, y: number): void;
}

test('mapa de 150×150 con pueblo; el supermercado, con su nombre, se marca para saquear', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=11&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();

  const info = await page.evaluate(() => {
    const { world } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    return {
      size: [world.grid.width, world.grid.height],
      kinds: [...new Set(world.houses.map((h) => h.kind))].sort(),
    };
  });
  expect(info.size).toEqual([150, 150]);
  expect(info.kinds).toEqual(
    [
      'clothes',
      'farm',
      'gas',
      'hardware',
      'house',
      'pharmacy',
      'police',
      'supermarket',
      'warehouse',
    ].sort(),
  );

  // La cámara al supermercado; clic en su fachada: la ficha se titula "Supermercado".
  const facade = await page.evaluate(() => {
    const r = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    const h = r.world.houses.find((b) => b.kind === 'supermarket')!;
    r.centerOnTile(h.rect.x + Math.floor(h.rect.w / 2), h.rect.y + Math.floor(h.rect.h / 2));
    return { id: h.id, x: h.rect.x, y: h.rect.y + 2 };
  });
  await page.waitForTimeout(300);
  const at = await page.evaluate(
    ({ x, y }) => (window as unknown as { rimzomboid: Debug }).rimzomboid.tileToScreen(x, y),
    facade,
  );
  await page.mouse.click(at.x, at.y);
  const panel = page.getByTestId('house-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h2')).toHaveText('Supermercado');

  // Saquear (L): clic en la fachada marca todos sus muebles.
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await page.mouse.click(at.x, at.y);
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(async () =>
      page.evaluate((id) => {
        const { world } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
        const mine = world.containers.filter((c) => c.houseId === id);
        return mine.length > 0 && mine.every((c) => c.designated);
      }, facade.id),
    )
    .toBe(true);
  expect(errores).toEqual([]);
});
