import { expect, test } from '@playwright/test';

interface Debug {
  world: {
    seen: number[];
    houses: { id: number; rect: { x: number; y: number }; door: { x: number; y: number } }[];
    base: { door: { x: number; y: number } };
    containers: { houseId: number; designated: boolean }[];
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
}

test('niebla al empezar, herramienta Saquear y marcar una casa', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=3&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();

  // Niebla: al empezar quedan casillas sin ver.
  const unseen = await page.evaluate(
    () =>
      (window as unknown as { rimzomboid: Debug }).rimzomboid.world.seen.filter((v) => v === 0)
        .length,
  );
  expect(unseen).toBeGreaterThan(1000);

  // El botón Saquear entra y sale del modo.
  const toolBtn = page.getByTestId('hud-loot-tool');
  await toolBtn.click();
  await expect(toolBtn).toHaveClass(/active/);
  await page.keyboard.press('Escape');
  await expect(toolBtn).not.toHaveClass(/active/);

  // Alejar la cámara y marcar la casa visible más cercana.
  await page.mouse.move(640, 400);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(300);
  const target = await page.evaluate(() => {
    const { world, tileToScreen } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    const d = (h: Debug['world']['houses'][number]) =>
      Math.hypot(h.door.x - world.base.door.x, h.door.y - world.base.door.y);
    const vp = { w: window.innerWidth, h: window.innerHeight };
    const on = (p: { x: number; y: number }) =>
      p.x > 20 && p.y > 60 && p.x < vp.w - 20 && p.y < vp.h - 120;
    const h = [...world.houses]
      .sort((a, b) => d(a) - d(b))
      .find((h) => on(tileToScreen(h.rect.x + 2, h.rect.y + 2)))!;
    return { id: h.id, ...tileToScreen(h.rect.x + 2, h.rect.y + 2) };
  });
  await page.keyboard.press('l');
  await page.mouse.click(target.x, target.y);
  await page.keyboard.press('Escape');
  await page.locator('[data-speed="1"]').click(); // la orden se aplica en el siguiente tick
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (window as unknown as { rimzomboid: Debug }).rimzomboid.world.containers.some(
            (c) => c.houseId === id && c.designated,
          ),
        target.id,
      ),
    )
    .toBe(true);
  expect(errores).toEqual([]);
});
