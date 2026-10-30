import { expect, test, type Page } from '@playwright/test';

// H5c1 §8: el clic derecho en una ventana (se cierra con Esc o con un clic fuera) y los menús
// Construir y Fabricar por grupos.

interface Debug {
  world: {
    base: { rect: { x: number; y: number; w: number; h: number } };
    grid: { width: number; tiles: number[] };
    seen: number[];
    nextBillId: number;
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  centerOnTile(x: number, y: number): void;
}

const WINDOWS = [5, 12]; // Tile.Window, Tile.CurtainedWindow

/** Una ventana vista de la base, con la cámara centrada en ella; su punto en pantalla. */
async function baseWindow(page: Page): Promise<{ x: number; y: number }> {
  const tile = await page.evaluate((WINDOWS) => {
    const { world, centerOnTile } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    const r = world.base.rect;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = y * world.grid.width + x;
        if (WINDOWS.includes(world.grid.tiles[i]!) && world.seen[i]) {
          centerOnTile(x, y);
          return { x, y };
        }
      }
    return null;
  }, WINDOWS);
  expect(tile).not.toBeNull();
  await page.waitForTimeout(200); // la cámara se mueve en el siguiente fotograma
  return page.evaluate(
    ({ x, y }) => (window as unknown as { rimzomboid: Debug }).rimzomboid.tileToScreen(x, y),
    tile!,
  );
}

test('clic derecho en una ventana: sus opciones; Esc o un clic fuera lo cierran', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=3&debug=1');
  await page.locator('[data-speed="0"]').click();
  const at = await baseWindow(page);
  const menu = page.getByTestId('context-menu');
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('ctx-board')).toContainText('Tapiar — 3 tablas (tienes');
  await expect(page.getByTestId('ctx-smashWindow')).toHaveText('Romper ventana');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(menu).toBeVisible();
  await page.mouse.click(20, 300); // fuera
  await expect(menu).toBeHidden();
  expect(errores).toEqual([]);
});

test('Construir y Fabricar por grupos, con lo que gasta, «usa → da» y los modos claros', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=3&debug=1');
  await page.locator('[data-speed="0"]').click();

  await page.keyboard.press('b');
  const build = page.getByTestId('build-menu');
  await expect(build.locator('.build-group h3')).toHaveText([
    'Muebles',
    'Muros y puertas',
    'Arreglar',
  ]);
  await expect(page.getByTestId('build-bed')).toContainText('Cama — 6 tablas (tienes');
  await page.getByTestId('build-bed').click();
  await expect(page.getByTestId('build-desc')).toContainText('se duerme mejor');
  await page.keyboard.press('Escape');

  await page.keyboard.press('f');
  const craft = page.getByTestId('craft-panel');
  await expect(craft.locator('.craft-group h3')).toHaveText([
    'Curar',
    'Tela y cortinas',
    'Ropa',
    'Bolsas',
  ]);
  await expect(page.getByTestId('craft-line-bandages')).toHaveText(
    '1 tela → 2 vendas · mesa · 15 min',
  );
  await expect(page.getByTestId('craft-add-curtains')).toHaveText('+ Coser cortinas');
  const id = await page.evaluate(
    () => (window as unknown as { rimzomboid: Debug }).rimzomboid.world.nextBillId,
  );
  await page.getByTestId('craft-add-bandages').click();
  const mode = page.getByTestId(`bill-${id}-mode`);
  await expect(mode.locator('option:checked')).toHaveText('Hasta tener 5 vendas');
  await mode.selectOption('count');
  await expect(mode.locator('option:checked')).toHaveText('Hacer 5 veces');
  expect(errores).toEqual([]);
});
