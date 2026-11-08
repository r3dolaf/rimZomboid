import { expect, test, type Page } from '@playwright/test';

// U1: las ayudas al jugador nuevo y la interfaz más clara, en el ordenador y en el móvil: la Ayuda
// (en la portada y en la partida, que pausa), los primeros pasos, el letrero de la herramienta con
// «Hecho», «En pausa» y saquear una casa con el clic derecho o manteniéndola pulsada.

interface Debug {
  world: {
    houses: { id: number; rect: { x: number; y: number; w: number; h: number } }[];
    containers: { houseId: number; designated: boolean }[];
    seen: number[];
    grid: { width: number };
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  centerOnTile(x: number, y: number): void;
}

function watchErrors(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  return errores;
}

/** Una casa vista por fuera, con la cámara en su centro; su id y su punto en pantalla. */
async function aHouse(page: Page): Promise<{ id: number; x: number; y: number }> {
  const got = await page.evaluate(() => {
    const { world, centerOnTile } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    for (const h of world.houses) {
      const x = h.rect.x + Math.floor(h.rect.w / 2);
      const y = h.rect.y + Math.floor(h.rect.h / 2);
      if (!world.containers.some((c) => c.houseId === h.id)) continue;
      centerOnTile(x, y);
      return { id: h.id, x, y };
    }
    return null;
  });
  expect(got).not.toBeNull();
  await page.waitForTimeout(200); // la cámara se mueve en el siguiente fotograma
  const at = await page.evaluate(
    ({ x, y }) => (window as unknown as { rimzomboid: Debug }).rimzomboid.tileToScreen(x, y),
    got!,
  );
  return { id: got!.id, ...at };
}

const marked = (page: Page, houseId: number) =>
  page.evaluate(
    (id) =>
      (window as unknown as { rimzomboid: Debug }).rimzomboid.world.containers.some(
        (c) => c.houseId === id && c.designated,
      ),
    houseId,
  );

test.describe('en el ordenador', () => {
  test('portada: de qué va y «❓ Cómo se juega» abre la Ayuda', async ({ page }) => {
    const errores = watchErrors(page);
    await page.goto('/');
    await expect(page.getByTestId('start-pitch')).toContainText('trabajan solos');
    await expect(page.getByTestId('narrator-calm')).toContainText('Para empezar');
    await page.getByTestId('start-help').click();
    const help = page.getByTestId('help-panel');
    await expect(help).toBeVisible();
    await page.getByTestId('help-tab-controls').click();
    await expect(help).toContainText('Con ratón y teclado');
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    // Al empezar, la de la portada se va (la de la partida es otra).
    await page.getByTestId('start-go').click();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByTestId('help-panel')).toHaveCount(1);
    expect(errores).toEqual([]);
  });

  test('primeros pasos, Ayuda que pausa, «En pausa» y la herramienta con «Hecho»', async ({
    page,
  }) => {
    const errores = watchErrors(page);
    await page.goto('/?seed=5&debug=1');
    const coach = page.getByTestId('coach');
    await expect(coach).toBeVisible();
    await expect(page.getByTestId('coach-step-people')).toBeVisible();
    // Paso 1: ver a alguien.
    await page.locator('[data-testid^="card-"]').first().click();
    await expect(page.getByTestId('coach-step-loot')).toBeVisible();
    await page.getByTestId('sheet-close').click();

    // La Ayuda pausa y, al cerrarla, sigue.
    await page.getByTestId('hud-help').click();
    await expect(page.getByTestId('help-panel')).toBeVisible();
    await expect(page.getByTestId('hud-paused')).toBeVisible();
    await page.getByTestId('help-close').click();
    await expect(page.getByTestId('hud-paused')).toBeHidden();
    // H también la abre.
    await page.keyboard.press('h');
    await expect(page.getByTestId('help-panel')).toBeVisible();
    await page.keyboard.press('Escape');

    // «En pausa» al pausar; al seguir, se va.
    await page.keyboard.press('Space');
    await expect(page.getByTestId('hud-paused')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('hud-paused')).toBeHidden();

    // Con una herramienta: su letrero (y no la tarjeta de pasos); «Hecho» la quita.
    await page.keyboard.press('t');
    const hint = page.getByTestId('tool-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('árbol');
    await expect(coach).toBeHidden();
    await page.getByTestId('tool-hint-done').click();
    await expect(hint).toBeHidden();
    await expect(page.getByTestId('hud-chop-tool')).not.toHaveClass(/active/);
    await expect(coach).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('clic derecho en una casa: saquearla (y el paso se da por hecho)', async ({ page }) => {
    const errores = watchErrors(page);
    await page.goto('/?seed=5&debug=1');
    await page.locator('[data-speed="0"]').click();
    const house = await aHouse(page);
    await page.mouse.click(house.x, house.y, { button: 'right' });
    const loot = page.getByTestId('ctx-lootHouse');
    await expect(loot).toContainText('Saquear');
    await loot.click();
    await page.locator('[data-speed="1"]').click();
    await expect.poll(() => marked(page, house.id)).toBe(true);
    // El paso de la comida, hecho (el de ver a alguien no: sale ese).
    await expect(page.getByTestId('coach-step-people')).toBeVisible();
    await expect(page.getByTestId('coach')).toContainText('Paso 2 de 7');
    expect(errores).toEqual([]);
  });
});

test.describe('en el móvil (844 × 390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('❓ en la barra, los pasos dicen «toca», y mantener pulsada una casa la saquea', async ({
    page,
  }) => {
    const errores = watchErrors(page);
    await page.goto('/?seed=5&debug=1');
    await expect(page.locator('canvas')).toBeVisible();
    await page.locator('[data-speed="0"]').tap();
    await expect(page.getByTestId('hud-help')).toBeVisible();
    await expect(page.getByTestId('coach')).toContainText('Toca una tarjeta');

    // La tarjeta de pasos no tapa las herramientas.
    const coach = (await page.getByTestId('coach').boundingBox())!;
    const tool = (await page.getByTestId('hud-build-tool').boundingBox())!;
    expect(coach.x + coach.width).toBeLessThanOrEqual(tool.x);

    // La Ayuda, con los controles del dedo primero.
    await page.getByTestId('hud-help').tap();
    await page.getByTestId('help-tab-controls').tap();
    await expect(page.getByTestId('help-panel').locator('h3').first()).toHaveText('Con el dedo');
    await page.getByTestId('help-close').tap();

    // Mantener pulsada una casa (con los dedos de Chromium): el menú con Saquear.
    const house = await aHouse(page);
    const cdp = await page.context().newCDPSession(page);
    const touchPoints = [{ x: Math.round(house.x), y: Math.round(house.y), id: 0 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
    await page.waitForTimeout(700); // mantener (0,45 s)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const loot = page.getByTestId('ctx-lootHouse');
    await expect(loot).toBeVisible();
    await loot.tap();
    await page.locator('[data-speed="1"]').tap();
    await expect.poll(() => marked(page, house.id)).toBe(true);

    // Con una herramienta, su letrero a la derecha y «Hecho».
    await page.getByTestId('hud-chop-tool').tap();
    await expect(page.getByTestId('tool-hint')).toContainText('Toca un árbol');
    await page.getByTestId('tool-hint-done').tap();
    await expect(page.getByTestId('hud-chop-tool')).not.toHaveClass(/active/);
    expect(errores).toEqual([]);
  });
});
