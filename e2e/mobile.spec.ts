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

/** Los paneles del menú ☰: su línea, el panel y su botón de cerrar (U1: Atuendos y Avisos, como
 * pestañas de Trabajos y Partida). */
const PANELS = [
  ['storage', 'storage-panel', '[data-testid="storage-close"]'],
  ['work', 'work-panel', '[data-testid="work-close"]'],
  ['craft', 'craft-panel', '[data-testid="craft-close"]'],
  ['expeditions', 'expeditions-panel', '[data-testid="expeditions-close"]'],
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
    // U1: los filtros, tras «Filtrar».
    await expect(page.getByTestId('log-filter-social')).toBeHidden();
    await page.getByTestId('log-filter-toggle').tap();
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
    // U1 §3: Atuendos y Avisos, como pestañas de Trabajos y Partida, en el mismo sitio.
    for (const [key, tab, panelId, other] of [
      ['work', 'tab-outfits', 'outfits-panel', 'work-panel'],
      ['game', 'tab-notices', 'notice-menu', 'game-panel'],
    ] as const) {
      await page.getByTestId('hud-more').tap();
      await page.getByTestId(`hud-menu-${key}`).tap();
      await page.getByTestId(other).getByTestId(tab).tap();
      const panel = page.getByTestId(panelId);
      await expect(panel).toBeVisible();
      await expect(page.getByTestId(other)).toBeHidden();
      inside((await panel.boundingBox())!, r, width);
      await panel.locator('.close').first().tap();
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

// M3: botones para el dedo, el notch, guardar al salir, instalable y el aviso de girar.

/** Hace como si la pestaña se escondiera (otra app, pantalla apagada). */
const hideTab = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
const savedTick = (page: Page) =>
  page.evaluate(() => {
    const text = localStorage.getItem('rimzomboid.partida');
    return text === null ? null : (JSON.parse(text) as { world: { tick: number } }).world.tick;
  });
const tick = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { rimzomboid: { world: { tick: number } } }).rimzomboid.world.tick,
  );

test.describe('M3 en el móvil (844 × 390, con el dedo)', () => {
  test.use(phone);

  test('los botones de la barra y la columna miden al menos 44 px', async ({ page }) => {
    const errores = await start(page);
    for (const id of ['hud-more', 'hud-loot-tool', 'hud-chop-tool', 'hud-build-tool']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.height, id).toBeGreaterThanOrEqual(44);
      expect(b.width, id).toBeGreaterThanOrEqual(44);
    }
    for (const s of [0, 1, 2, 3]) {
      const b = (await page.locator(`[data-speed="${s}"]`).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByTestId('hud-more').tap();
    const item = (await page.getByTestId('hud-menu-work').boundingBox())!;
    expect(item.height).toBeGreaterThanOrEqual(44);
    expect(errores).toEqual([]);
  });

  test('con un notch (47 px a los lados, 21 abajo) nada queda debajo', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 0, left: 47, right: 47, bottom: 21 },
    });
    const errores = await start(page);
    const { width, height } = page.viewportSize()!;
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
    expect((await box('hud-time')).x).toBeGreaterThanOrEqual(47);
    for (const id of ['hud-more', 'hud-loot-tool', 'hud-build-tool']) {
      const b = await box(id);
      expect(b.x + b.width, id).toBeLessThanOrEqual(width - 47);
    }
    const card = await box('card-1');
    expect(card.x).toBeGreaterThanOrEqual(47);
    expect(card.y + card.height).toBeLessThanOrEqual(height - 21);
    expect((await box('log')).x).toBeGreaterThanOrEqual(47);
    await page.getByTestId('card-1').tap();
    const sheet = await box('sheet');
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(width - 47);
    expect(errores).toEqual([]);
  });

  test('con ?debug=1, la depuración desde el ☰ (para medir en el móvil, sin F3)', async ({
    page,
  }) => {
    const errores = await start(page);
    await page.getByTestId('hud-more').tap();
    await page.getByTestId('hud-menu-debug').tap();
    const panel = page.getByTestId('debug-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('debug-perf')).toContainText('ms por tick');
    const b = (await panel.boundingBox())!;
    const bar = (await page.locator('.hud-bar').boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(bar.y + bar.height - 0.5);
    expect(errores).toEqual([]);
  });

  test('al esconder la pestaña se guarda, pero solo si esta partida ya es la guardada', async ({
    page,
  }) => {
    const errores = await start(page);
    await page.evaluate(() => localStorage.removeItem('rimzomboid.partida'));
    // Nueva y sin guardar: no pisa nada.
    await hideTab(page);
    expect(await savedTick(page)).toBeNull();
    // Guardada a mano: desde ahora se guarda también al salir, con lo jugado después.
    await page.getByTestId('hud-more').tap();
    await page.getByTestId('hud-menu-game').tap();
    await page.getByTestId('game-save').tap();
    await expect(page.getByTestId('game-status')).toHaveText('Partida guardada');
    const first = (await savedTick(page))!;
    await page.getByTestId('game-panel').locator('.close').tap();
    await page.locator('[data-speed="3"]').tap();
    await expect.poll(() => tick(page)).toBeGreaterThan(first + 10);
    await page.locator('[data-speed="0"]').tap();
    const now = await tick(page);
    await hideTab(page);
    expect(await savedTick(page)).toBe(now);
    expect(errores).toEqual([]);
  });
});

test('instalable: el manifiesto, con sus iconos, y los enlaces de la página', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('manifest.webmanifest');
  const manifest = (await (await request.get(`/${href}`)).json()) as {
    display: string;
    orientation: string;
    icons: { src: string; sizes: string }[];
  };
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.orientation).toBe('landscape');
  expect(manifest.icons.map((i) => i.sizes)).toContain('512x512');
  const icons = [
    ...manifest.icons.map((i) => i.src),
    (await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'))!,
    (await page.locator('link[rel="icon"]').getAttribute('href'))!,
  ];
  for (const src of icons) {
    const res = await request.get(`/${src}`);
    expect(res.status(), src).toBe(200);
    expect(res.headers()['content-type'], src).toContain('image/png');
  }
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
});

test.describe('móvil en vertical (390 × 844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('sale el aviso de girar y «Seguir así» lo quita', async ({ page }) => {
    await page.goto('/');
    const hint = page.getByTestId('rotate-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Se juega mejor en horizontal');
    await page.getByTestId('rotate-hint-dismiss').tap();
    await expect(hint).toBeHidden();
    await expect(page.getByTestId('start-go')).toBeVisible();
  });
});

test('en el ordenador (1280 × 720, con ratón) no sale el aviso de girar ni cambian los botones', async ({
  page,
}) => {
  await page.goto('/?seed=5');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
  const b = (await page.locator('[data-speed="1"]').boundingBox())!;
  expect(b.height).toBeLessThan(36);
  await expect(page.getByTestId('hud-more')).toBeHidden();
});
