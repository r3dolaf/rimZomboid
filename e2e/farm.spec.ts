import { expect, test, type Page } from '@playwright/test';

// V1: el huerto en el navegador: el botón Huerto marca parcelas con un clic y con un arrastre.
interface Debug {
  world: {
    plots: { tile: number }[];
    base: { rect: { x: number; y: number; w: number; h: number } };
    grid: { width: number; height: number };
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  canPlot(x: number, y: number): boolean;
}

/** Un rectángulo de 3×2 donde se puede poner huerto, cerca de la base y sin paneles encima. */
async function field(page: Page) {
  return page.evaluate(() => {
    const { world, tileToScreen, canPlot } = (window as unknown as { rimzomboid: Debug })
      .rimzomboid;
    const r = world.base.rect;
    const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
    const vp = { w: window.innerWidth, h: window.innerHeight };
    const free = (p: { x: number; y: number }) =>
      p.x > 20 && p.y > 80 && p.x < vp.w - 320 && p.y < vp.h - 200;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y < world.grid.height - 1; y++)
      for (let x = 0; x < world.grid.width - 2; x++) {
        let ok = true;
        for (let dy = 0; dy < 2 && ok; dy++)
          for (let dx = 0; dx < 3 && ok; dx++)
            ok = canPlot(x + dx, y + dy) && free(tileToScreen(x + dx, y + dy));
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (ok && d < bestD) {
          best = { x, y };
          bestD = d;
        }
      }
    if (!best) return null;
    return { a: tileToScreen(best.x, best.y), b: tileToScreen(best.x + 2, best.y + 1) };
  });
}

const plots = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.world.plots.length);

test('herramienta Huerto: clic marca una parcela, arrastrar un rectángulo', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=3&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();
  await page.getByTestId('hud-farm-tool').click();
  await expect(page.getByTestId('hud-farm-tool')).toHaveClass(/active/);
  const spot = await field(page);
  expect(spot).not.toBeNull();
  // Un clic: una parcela (se aplica al seguir el tiempo).
  await page.mouse.click(spot!.a.x, spot!.a.y);
  await page.locator('[data-speed="1"]').click();
  await expect.poll(() => plots(page)).toBe(1);
  await page.locator('[data-speed="0"]').click();
  // Arrastrar: el rectángulo de 3×2 (la primera ya estaba).
  await page.mouse.move(spot!.a.x, spot!.a.y);
  await page.mouse.down();
  await page.mouse.move(spot!.b.x, spot!.b.y, { steps: 5 });
  await page.mouse.up();
  await page.locator('[data-speed="1"]').click();
  await expect.poll(() => plots(page)).toBe(6);
  await page.screenshot({ path: 'test-results/huerto.png' });
  // H quita la herramienta.
  await page.keyboard.press('h');
  await expect(page.getByTestId('hud-farm-tool')).not.toHaveClass(/active/);
  expect(errores).toEqual([]);
});
