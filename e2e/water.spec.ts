import { expect, test } from '@playwright/test';

// V2: el agua en el navegador: 💧 en la barra de arriba (con «+» mientras hay agua corriente) y el
// barril de lluvia en Construir.
interface Debug {
  world: {
    blueprints: { kind: string }[];
    base: { rect: { x: number; y: number; w: number; h: number } };
    grid: { width: number; height: number };
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  canPlace(kind: string, x: number, y: number): boolean;
}

test('agua en la barra de arriba, la estación y barril de lluvia en Construir', async ({
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
  const water = page.getByTestId('hud-water');
  await expect(water).toBeVisible();
  await expect(water).toContainText('+');
  await expect(water).toHaveAttribute('title', /hay agua corriente/);
  // V3: la estación y la temperatura, junto a las pestañas de mapa.
  await expect(page.getByTestId('hud-season')).toContainText('Verano');
  await expect(page.getByTestId('hud-season')).toContainText('°C');

  // Construir → Barril de lluvia, en la casilla libre más cercana a la base que se vea.
  await page.keyboard.press('b');
  await page.getByTestId('build-barrel').click();
  await expect(page.getByTestId('build-barrel')).toHaveClass(/selected/);
  const menu = await page.getByTestId('build-menu').boundingBox();
  const spot = await page.evaluate((menu) => {
    const { world, tileToScreen, canPlace } = (window as unknown as { rimzomboid: Debug })
      .rimzomboid;
    const r = world.base.rect;
    const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
    const vp = { w: window.innerWidth, h: window.innerHeight };
    // Fuera del menú Construir (arriba), de los paneles y de las tarjetas.
    const free = (p: { x: number; y: number }) =>
      p.x > 20 &&
      p.y > 80 &&
      p.x < vp.w - 320 &&
      p.y < vp.h - 200 &&
      !(menu && p.x >= menu.x && p.x <= menu.x + menu.width && p.y <= menu.y + menu.height + 10);
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y < world.grid.height; y++)
      for (let x = 0; x < world.grid.width; x++) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d >= bestD || !canPlace('barrel', x, y)) continue;
        const p = tileToScreen(x, y);
        if (!free(p)) continue;
        best = p;
        bestD = d;
      }
    return best;
  }, menu);
  expect(spot).not.toBeNull();
  await page.mouse.click(spot!.x, spot!.y);
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { rimzomboid: Debug }).rimzomboid.world.blueprints.map((b) => b.kind),
      ),
    )
    .toContain('barrel');
  expect(errores).toEqual([]);
});
