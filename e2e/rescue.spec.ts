import { expect, test } from '@playwright/test';

// C1: la radio y el rescate en el navegador: Construir → Radio (apagada sin una radio en el almacén)
// y, con los trucos de depuración, todos al helicóptero hasta la pantalla final de victoria.
interface Debug {
  world: {
    blueprints: { kind: string }[];
    storage: { items: { radio: number } };
    base: { rect: { x: number; y: number; w: number; h: number } };
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  canPlace(kind: string, x: number, y: number): boolean;
  centerOnTile(x: number, y: number): void;
}

test('Construir → Radio: apagada sin radio en el almacén; con una, se pone el plano', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/?seed=3&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();
  await page.keyboard.press('b');
  const radio = page.getByTestId('build-radio');
  await expect(radio).toBeDisabled();
  await expect(radio).toHaveAttribute('title', /hace falta una radio en el almacén/);
  await page.evaluate(() => {
    (window as unknown as { rimzomboid: Debug }).rimzomboid.world.storage.items.radio = 1;
  });
  await expect(radio).toBeEnabled();
  await radio.click();
  // Una casilla de la base donde cabe, en el centro de la pantalla (lejos de avisos y menús).
  const spot = await page.evaluate(async () => {
    const { world, tileToScreen, canPlace, centerOnTile } = (
      window as unknown as { rimzomboid: Debug }
    ).rimzomboid;
    const r = world.base.rect;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!canPlace('radio', x, y)) continue;
        centerOnTile(x, y);
        await new Promise((ok) => setTimeout(ok, 200));
        return tileToScreen(x, y);
      }
    return null;
  });
  expect(spot).not.toBeNull();
  await page.mouse.click(spot!.x, spot!.y);
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { rimzomboid: Debug }).rimzomboid.world.blueprints.map((b) => b.kind),
      ),
    )
    .toContain('radio');
  expect(errores).toEqual([]);
});

test('todos al helicóptero: el aviso, suben y la pantalla final de victoria', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/?seed=3&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();
  await page.keyboard.press('F3');
  await page.getByTestId('debug-evac').click();
  await page.locator('[data-speed="3"]').click();
  // El helicóptero anunciado pausa, y el que llega también: cada vez, se sigue.
  const notices = page.getByTestId('notices');
  await expect(notices).toContainText('La radio: ¡un helicóptero!', { timeout: 20_000 });
  await page.locator('[data-speed="3"]').click();
  await expect(notices).toContainText('¡El helicóptero!', { timeout: 20_000 });
  await page.locator('[data-speed="3"]').click();
  const end = page.getByTestId('end-screen');
  await expect(end).toBeVisible({ timeout: 90_000 });
  await expect(end.locator('h1')).toHaveText('¡Os han rescatado!');
  await expect(end).toContainText('Quién se salvó');
  await expect(end).toContainText('en el helicóptero');
  expect(errores).toEqual([]);
});
