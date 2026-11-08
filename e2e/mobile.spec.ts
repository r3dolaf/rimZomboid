import { expect, test, type Page } from '@playwright/test';

// M2: en un móvil en horizontal todo cabe y se llega a todo: la barra con el menú ☰, las
// herramientas en su columna, el registro plegado, cada panel entre la barra y las tarjetas, y la
// portada entera. En una tableta, el menú ☰ y las herramientas con su nombre.

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const phone = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };

/** Los paneles del menú ☰: su línea, el panel y su botón de cerrar. */
const PANELS = [
  ['storage', 'storage-panel', '[data-testid="storage-close"]'],
  ['work', 'work-panel', '[data-testid="work-close"]'],
  ['craft', 'craft-panel', '[data-testid="craft-close"]'],
  ['outfits', 'outfits-panel', '[data-testid="outfits-close"]'],
  ['expeditions', 'expeditions-panel', '[data-testid="expeditions-close"]'],
  ['notices', 'notice-menu', '[data-testid="notice-menu-close"]'],
  ['game', 'game-panel', '.close'],
] as const;

async function start(page: Page) {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=5&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').tap();
  return errores;
}

/** Lo que queda entre la barra y las tarjetas (en pantalla). */
async function room(page: Page) {
  const bar = (await page.locator('.hud-bar').boundingBox())!;
  const cards = (await page.locator('.cards').boundingBox())!;
  return { top: bar.y + bar.height, bottom: cards.y };
}

const inside = (b: Box, r: { top: number; bottom: number }, width: number) => {
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(width + 0.5);
  expect(b.y).toBeGreaterThanOrEqual(r.top - 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(r.bottom + 0.5);
};

test.describe('móvil en horizontal (844 × 390)', () => {
  test.use(phone);

  test('la barra cabe; los paneles, en el ☰; las herramientas, en su columna; el registro, plegado', async ({
    page,
  }) => {
    const errores = await start(page);
    const sizes = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      bar: document.querySelector('.hud-bar')!.scrollWidth,
      width: innerWidth,
    }));
    expect(sizes.page).toBeLessThanOrEqual(sizes.width);
    expect(sizes.bar).toBeLessThanOrEqual(sizes.width);
    await expect(page.getByTestId('hud-more')).toBeVisible();
    for (const [key] of PANELS) await expect(page.getByTestId(`hud-${key}`)).toBeHidden();

    // Las herramientas, juntas en el borde derecho, una debajo de otra; tocar una la activa.
    const boxes: Box[] = [];
    for (const id of ['hud-loot-tool', 'hud-chop-tool', 'hud-build-tool']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.x + b.width).toBeGreaterThan(sizes.width - 60);
      expect(b.x + b.width).toBeLessThanOrEqual(sizes.width);
      boxes.push(b);
    }
    expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
    expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y);
    await page.getByTestId('hud-chop-tool').tap();
    await expect(page.getByTestId('hud-chop-tool')).toHaveClass(/active/);
    await page.getByTestId('hud-chop-tool').tap();
    await expect(page.getByTestId('hud-chop-tool')).not.toHaveClass(/active/);

    // El registro empieza plegado (solo la cabecera) y se puede desplegar.
    const log = page.getByTestId('log');
    await expect(log).toHaveClass(/collapsed/);
    await expect(page.getByTestId('log-filter-social')).toBeHidden();
    await page.getByTestId('log-toggle').tap();
    await expect(log).not.toHaveClass(/collapsed/);
    await expect(page.getByTestId('log-filter-social')).toBeVisible();
    const r = await room(page);
    inside((await log.boundingBox())!, { top: r.top, bottom: r.bottom }, sizes.width);
    expect(errores).toEqual([]);
  });

  test('cada panel del ☰ se abre entre la barra y las tarjetas y se cierra con su ×', async ({
    page,
  }) => {
    const errores = await start(page);
    const r = await room(page);
    const width = page.viewportSize()!.width;
    const menu = page.getByTestId('hud-menu');
    for (const [key, panelId, close] of PANELS) {
      await page.getByTestId('hud-more').tap();
      await expect(menu).toBeVisible();
      await page.getByTestId(`hud-menu-${key}`).tap();
      await expect(menu).toBeHidden();
      const panel = page.getByTestId(panelId);
      await expect(panel).toBeVisible();
      inside((await panel.boundingBox())!, r, width);
      await panel.locator(close).first().tap();
      await expect(panel).toBeHidden();
    }
    // Tocar fuera cierra el menú sin abrir nada.
    await page.getByTestId('hud-more').tap();
    await page.touchscreen.tap(300, 200);
    await expect(menu).toBeHidden();

    // La ficha del colono y el menú de Construir, también dentro.
    await page.getByTestId('card-1').tap();
    const sheet = page.getByTestId('sheet');
    await expect(sheet).toBeVisible();
    inside((await sheet.boundingBox())!, r, width);
    await page.getByTestId('sheet-close').tap();
    await page.getByTestId('hud-build-tool').tap();
    const build = page.getByTestId('build-menu');
    await expect(build).toBeVisible();
    const b = (await build.boundingBox())!;
    inside(b, r, width);
    expect(b.x).toBeLessThan(10); // a la izquierda: el mapa y las herramientas, libres
    expect(errores).toEqual([]);
  });

  test('la portada se ve entera desde arriba y se puede bajar hasta Empezar', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.start-panel');
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await expect(page.locator('.start h1')).toBeInViewport();
    const go = page.getByTestId('start-go');
    await go.scrollIntoViewIfNeeded();
    await expect(go).toBeInViewport();
  });
});

test.describe('tableta en horizontal (1024 × 768)', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('los paneles en el ☰ y las herramientas con su nombre en la barra', async ({ page }) => {
    const errores = await start(page);
    const width = await page.evaluate(() => document.querySelector('.hud-bar')!.scrollWidth);
    expect(width).toBeLessThanOrEqual(1024);
    await expect(page.getByTestId('hud-more')).toBeVisible();
    await expect(page.getByTestId('hud-work')).toBeHidden();
    const loot = page.getByTestId('hud-loot-tool');
    await expect(loot).toBeVisible();
    await expect(loot).toHaveText('Saquear');
    expect((await loot.boundingBox())!.y).toBeLessThan(20); // en la barra, no en la columna
    await expect(page.getByTestId('log')).not.toHaveClass(/collapsed/);
    expect(errores).toEqual([]);
  });
});
