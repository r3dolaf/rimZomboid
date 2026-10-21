import { expect, test, type Page } from '@playwright/test';

interface Debug {
  world: {
    survivors: { id: number; work: Record<string, boolean> }[];
    blueprints: { kind: string; pos: { x: number; y: number } }[];
    orders: { type: string }[];
    chopMarks: number[];
    base: { rect: { x: number; y: number; w: number; h: number } };
    grid: { width: number; height: number; tiles: number[] };
    seen: number[];
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  canPlace(kind: string, x: number, y: number): boolean;
}

const TREE = 6; // Tile.Tree

/** Una casilla que cumpla `ok`, la más cercana al centro de la base, que se vea sin paneles encima. */
async function spotFor(page: Page, what: 'campfire' | 'tree') {
  return page.evaluate(
    ({ what, TREE }) => {
      const { world, tileToScreen, canPlace } = (window as unknown as { rimzomboid: Debug })
        .rimzomboid;
      const r = world.base.rect;
      const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
      const vp = { w: window.innerWidth, h: window.innerHeight };
      const free = (p: { x: number; y: number }) =>
        p.x > 20 && p.y > 80 && p.x < vp.w - 320 && p.y < vp.h - 200;
      let best: { tile: { x: number; y: number }; screen: { x: number; y: number } } | null = null;
      let bestD = Infinity;
      for (let y = 0; y < world.grid.height; y++)
        for (let x = 0; x < world.grid.width; x++) {
          const i = y * world.grid.width + x;
          const ok =
            what === 'tree'
              ? world.grid.tiles[i] === TREE && world.seen[i] === 1
              : canPlace('campfire', x, y);
          const screen = tileToScreen(x, y);
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (ok && free(screen) && d < bestD) {
            best = { tile: { x, y }, screen };
            bestD = d;
          }
        }
      return best;
    },
    { what, TREE },
  );
}

const world = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.world);

test('panel de Trabajos, herramienta Talar y herramienta Construir', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=3&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();

  // Panel de Trabajos (J): quitar Transportar al primero se ve al momento, aunque esté en pausa.
  const panel = page.getByTestId('work-panel');
  await expect(panel).toBeHidden();
  await page.keyboard.press('j');
  await expect(panel).toBeVisible();
  const id = (await world(page)).survivors[0]!.id;
  const box = page.getByTestId(`work-${id}-haul`);
  await expect(box).toBeChecked();
  await box.click();
  await expect(box).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  // Talar (T): clic en un árbol visto.
  await page.keyboard.press('t');
  await expect(page.getByTestId('hud-chop-tool')).toHaveClass(/active/);
  const tree = await spotFor(page, 'tree');
  expect(tree).not.toBeNull();
  await page.mouse.click(tree!.screen.x, tree!.screen.y);
  expect((await world(page)).orders.map((o) => o.type)).toContain('markTree');

  // Construir (B): elegir hoguera en el menú y ponerla en una casilla libre de la base.
  await page.keyboard.press('b');
  const menu = page.getByTestId('build-menu');
  await expect(menu).toBeVisible();
  await page.getByTestId('build-campfire').click();
  await expect(page.getByTestId('build-campfire')).toHaveClass(/selected/);
  const spot = await spotFor(page, 'campfire');
  expect(spot).not.toBeNull();
  await page.mouse.click(spot!.screen.x, spot!.screen.y);

  // Al reanudar se aplican las órdenes: permiso, marca y plano.
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(async () => (await world(page)).blueprints.map((b) => `${b.kind}@${b.pos.x},${b.pos.y}`))
    .toContain(`campfire@${spot!.tile.x},${spot!.tile.y}`);
  const w = await world(page);
  expect(w.survivors.find((s) => s.id === id)!.work.haul).toBe(false);
  expect(w.chopMarks).toContain(tree!.tile.y * w.grid.width + tree!.tile.x);

  await page.keyboard.press('Escape'); // quita la herramienta y cierra el menú
  await expect(menu).toBeHidden();
  expect(errores).toEqual([]);
});
