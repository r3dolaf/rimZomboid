import { expect, test, type Page } from '@playwright/test';

// H4d: el panel Fabricar, las prioridades de trabajo y correr unas cortinas en la base.

interface Debug {
  world: {
    survivors: { id: number; priorities: Record<string, number> }[];
    bills: { id: number; recipe: string; mode: string; target: number }[];
    nextBillId: number;
    blueprints: { kind: string; pos: { x: number; y: number } }[];
    curtains: number[];
    base: { rect: { x: number; y: number; w: number; h: number } };
    grid: { width: number; height: number; tiles: number[] };
    seen: number[];
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  centerOnTile(x: number, y: number): void;
}

const WINDOW = 5; // Tile.Window
const CURTAINED = 12; // Tile.CurtainedWindow

const world = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.world);

/** Una ventana de la base con cortinas, con la cámara centrada en ella (lejos de los menús). */
async function baseWindow(page: Page) {
  const tile = await page.evaluate((WINDOW) => {
    const { world, centerOnTile } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    const r = world.base.rect;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = y * world.grid.width + x;
        if (world.grid.tiles[i] === WINDOW && world.curtains.includes(i) && world.seen[i]) {
          centerOnTile(x, y);
          return { x, y };
        }
      }
    return null;
  }, WINDOW);
  if (!tile) return null;
  await page.waitForTimeout(200); // la cámara se mueve en el siguiente fotograma
  const screen = await page.evaluate(
    ({ x, y }) => (window as unknown as { rimzomboid: Debug }).rimzomboid.tileToScreen(x, y),
    tile,
  );
  return { tile, screen };
}

test('panel Fabricar con sus pedidos, prioridades en Trabajos y correr unas cortinas', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=3&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();

  // Fabricar (F): lo que hay, añadir unas vendas y verlas al momento aunque esté en pausa.
  const panel = page.getByTestId('craft-panel');
  await expect(panel).toBeHidden();
  await page.keyboard.press('f');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('craft-stock')).toContainText('En el almacén:');
  const id = (await world(page)).nextBillId;
  await page.getByTestId('craft-add-bandages').click();
  const row = page.getByTestId(`bill-${id}`);
  await expect(row).toContainText('Vendas');
  await expect(page.getByTestId(`bill-${id}-target`)).toHaveText('5');
  await page.getByTestId(`bill-${id}-mode`).selectOption('count');
  await page.getByTestId(`bill-${id}-more`).click();
  await expect(page.getByTestId(`bill-${id}-target`)).toHaveText('6');
  await expect(page.getByTestId(`bill-${id}-done`)).toHaveText('hechos 0/6');

  // Trabajos (J) cierra Fabricar; la prioridad de Fabricar pasa de 3 a 4.
  await page.keyboard.press('j');
  await expect(panel).toBeHidden();
  const first = (await world(page)).survivors[0]!.id;
  const cell = page.getByTestId(`work-${first}-craft`);
  await expect(cell).toHaveText('3');
  await cell.click();
  await expect(cell).toHaveText('4');
  await page.keyboard.press('Escape');

  // Clic derecho en una ventana de la base (H5c1 §8) → Correr cortinas.
  const win = await baseWindow(page);
  expect(win).not.toBeNull();
  await page.mouse.click(win!.screen.x, win!.screen.y, { button: 'right' });
  await expect(page.getByTestId('context-menu')).toBeVisible();
  await page.getByTestId('ctx-curtains').click();
  await expect(page.getByTestId('context-menu')).toBeHidden();

  // Al reanudar se aplican el pedido, la prioridad y el plano; alguien corre las cortinas.
  await page.locator('[data-speed="3"]').click();
  await expect
    .poll(async () => (await world(page)).bills.map((b) => `${b.recipe}:${b.mode}:${b.target}`))
    .toEqual(['bandages:count:6']);
  expect((await world(page)).survivors[0]!.priorities.craft).toBe(4);
  const i = win!.tile.y * (await world(page)).grid.width + win!.tile.x;
  await expect
    .poll(async () => (await world(page)).grid.tiles[i], { timeout: 30_000 })
    .toBe(CURTAINED);
  expect(errores).toEqual([]);
});
