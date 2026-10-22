import { expect, test, type Page } from '@playwright/test';

// H4e: elegir a varios con el rectángulo, modo combate con R, mandarlos con el clic derecho; y el
// menú de Avisos, que se recuerda al recargar.

interface Debug {
  world: {
    base: { rect: { x: number; y: number; w: number; h: number }; door: { x: number; y: number } };
    survivors: {
      id: number;
      drafted: boolean;
      pos: { x: number; y: number };
      action: { type: string; target?: { x: number; y: number } };
    }[];
    orders: { type: string }[];
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  centerOnTile(x: number, y: number): void;
}

const debug = (page: Page) =>
  page.evaluate(() => {
    const { world } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    return { base: world.base, survivors: world.survivors, orders: world.orders };
  });

const screen = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) => (window as unknown as { rimzomboid: Debug }).rimzomboid.tileToScreen(x, y),
    { x, y },
  );

test('rectángulo, R y clic derecho: los elegidos van en modo combate adonde se manda', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=5&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').click();
  const { base, survivors } = await debug(page);
  await page.evaluate(
    ({ x, y }) => (window as unknown as { rimzomboid: Debug }).rimzomboid.centerOnTile(x, y),
    { x: base.rect.x + Math.floor(base.rect.w / 2), y: base.rect.y + Math.floor(base.rect.h / 2) },
  );
  await page.waitForTimeout(300);

  // El rectángulo sobre toda la base: elige a todos los colonos.
  const a = await screen(page, base.rect.x, base.rect.y);
  const b = await screen(page, base.rect.x + base.rect.w - 1, base.rect.y + base.rect.h - 1);
  await page.mouse.move(a.x - 6, a.y - 6);
  await page.mouse.down();
  await page.mouse.move(b.x + 6, b.y + 6, { steps: 8 });
  await page.mouse.up();
  const group = page.getByTestId('group-panel');
  await expect(group).toBeVisible();
  await expect(group.locator('[data-testid^="group-name-"]')).toHaveCount(survivors.length);

  // R: todos en modo combate (se ve al momento, aunque esté en pausa).
  await page.keyboard.press('r');
  for (const s of survivors) await expect(page.getByTestId(`card-${s.id}`)).toHaveClass(/drafted/);
  await expect(page.getByTestId('group-draft')).toHaveClass(/active/);

  // Clic derecho fuera, a unas casillas de la puerta: van allí.
  const goal = { x: base.door.x, y: base.door.y + 4 };
  const g = await screen(page, goal.x, goal.y);
  await page.mouse.click(g.x, g.y, { button: 'right' });
  expect((await debug(page)).orders.map((o) => o.type)).toEqual(['draft', 'draftMove']);
  await page.locator('[data-speed="3"]').click();
  await expect
    .poll(
      async () => {
        const ss = (await debug(page)).survivors;
        return ss.every(
          (s) =>
            s.drafted &&
            Math.abs(Math.floor(s.pos.x) - goal.x) <= 2 &&
            Math.abs(Math.floor(s.pos.y) - goal.y) <= 2,
        );
      },
      { timeout: 20_000 },
    )
    .toBe(true);

  // Otra vez R: lo quitan todos.
  await page.keyboard.press('r');
  await expect.poll(async () => (await debug(page)).survivors.every((s) => !s.drafted)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(group).toBeHidden();
  expect(errores).toEqual([]);
});

test('menú de Avisos: se abre desde arriba y lo que se apaga sigue apagado al recargar', async ({
  page,
}) => {
  await page.goto('/?seed=5&debug=1');
  await page.getByTestId('hud-notices').click();
  const menu = page.getByTestId('notice-menu');
  await expect(menu).toBeVisible();
  const fled = page.getByTestId('notice-show-fled');
  await expect(fled).toBeChecked();
  await fled.uncheck();
  await expect(page.getByTestId('notice-pause-fled')).toBeDisabled();
  await page.reload();
  await page.getByTestId('hud-notices').click();
  await expect(page.getByTestId('notice-show-fled')).not.toBeChecked();
  await page.getByTestId('notice-reset').click();
  await expect(page.getByTestId('notice-show-fled')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});
