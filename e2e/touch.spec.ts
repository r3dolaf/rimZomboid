import { expect, test, type CDPSession, type Page } from '@playwright/test';

// M1: con los dedos, en un móvil en horizontal. Tocar elige, arrastrar un dedo mueve la cámara,
// pellizcar acerca, mantener y arrastrar elige a varios, mantener pulsado manda a los que están en
// modo combate, mantener pulsada una tarjeta añade a ese colono; en el mapa del mundo, pellizcar y
// tocar un hexágono.

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

interface Pt {
  x: number;
  y: number;
}
interface Debug {
  world: {
    base: { rect: { x: number; y: number; w: number; h: number }; door: Pt };
    survivors: { id: number; drafted: boolean; pos: Pt }[];
    orders: { type: string }[];
    common: { atlas: { base: number } };
  };
  tileToScreen(x: number, y: number): Pt;
  centerOnTile(x: number, y: number): void;
  hexToScreen(i: number): Pt;
  centerOnHex(i: number): void;
}

const debug = <T, A>(page: Page, fn: (d: Debug, a: A) => T, arg: A) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { rimzomboid: Debug }).rimzomboid;
      return (new Function('d', 'a', `return (${f})(d, a)`) as (d: Debug, a: unknown) => T)(d, a);
    },
    [fn.toString(), arg as unknown] as const,
  );
const screen = (page: Page, x: number, y: number) =>
  debug(page, (d, p: Pt) => d.tileToScreen(p.x, p.y), { x, y });
const dist = (a: Pt, b: Pt) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const lerp = (a: Pt, b: Pt, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Los dedos, uno por punto, con los eventos táctiles de Chromium (varios a la vez). */
const fingers = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', pts: Pt[]) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: pts.map((p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id })),
  });

/** Cada dedo va de su `from` a su `to` en `steps` pasos; con `holdMs`, antes se mantiene quieto. */
async function gesture(page: Page, cdp: CDPSession, from: Pt[], to: Pt[], steps = 8, holdMs = 0) {
  await fingers(cdp, 'touchStart', from);
  if (holdMs) await page.waitForTimeout(holdMs);
  for (let i = 1; i <= steps; i++) {
    await fingers(
      cdp,
      'touchMove',
      from.map((f, k) => lerp(f, to[k]!, i / steps)),
    );
  }
  await fingers(cdp, 'touchEnd', []);
}

/** Lo que hay en ese punto es el juego (no un panel encima): si no, el gesto no le llegaría. */
async function onCanvas(page: Page, ...pts: Pt[]) {
  for (const p of pts) {
    const tag = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, p);
    expect(tag, `en (${p.x}, ${p.y}) hay algo encima del mapa`).toBe('CANVAS');
  }
}

async function start(page: Page) {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=5&debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('[data-speed="0"]').tap();
  const cdp = await page.context().newCDPSession(page);
  return { errores, cdp };
}

test('tocar a un colono abre su ficha; arrastrar un dedo mueve la cámara; pellizcar acerca', async ({
  page,
}) => {
  const { errores, cdp } = await start(page);
  const s = (await debug(page, (d) => d.world.survivors, 0))[0]!;
  await debug(page, (d, p: Pt) => d.centerOnTile(p.x, p.y), {
    x: Math.floor(s.pos.x),
    y: Math.floor(s.pos.y),
  });
  await page.waitForTimeout(200);

  // Tocar al colono (su punto, no el centro de la casilla).
  const at = await screen(page, s.pos.x - 0.5, s.pos.y - 0.5);
  await onCanvas(page, at);
  await page.touchscreen.tap(at.x, at.y);
  await expect(page.getByTestId('sheet')).toBeVisible();
  await page.getByTestId('sheet-close').tap();
  await expect(page.getByTestId('sheet')).toBeHidden();

  // Arrastrar un dedo: lo de debajo va con el dedo y no se elige a nadie.
  const tile = { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) };
  const before = await screen(page, tile.x, tile.y);
  const [a, b] = [
    { x: 440, y: 120 },
    { x: 520, y: 180 },
  ];
  await onCanvas(page, a, b);
  await gesture(page, cdp, [a], [b]);
  await page.waitForTimeout(100);
  const after = await screen(page, tile.x, tile.y);
  expect(Math.abs(after.x - before.x - (b.x - a.x))).toBeLessThan(3);
  expect(Math.abs(after.y - before.y - (b.y - a.y))).toBeLessThan(3);
  await expect(page.getByTestId('sheet')).toBeHidden();
  await expect(page.getByTestId('group-panel')).toBeHidden();

  // Pellizcar abriendo los dedos: el doble de cerca (zoom 2 → 4, el máximo), alrededor de los dedos.
  const mid = { x: 470, y: 160 };
  const p0 = await screen(page, tile.x, tile.y);
  const q0 = await screen(page, tile.x + 3, tile.y);
  await onCanvas(page, { x: 420, y: 160 }, { x: 520, y: 160 });
  await gesture(
    page,
    cdp,
    [
      { x: 440, y: 160 },
      { x: 500, y: 160 },
    ],
    [
      { x: 400, y: 160 },
      { x: 540, y: 160 },
    ],
  );
  await page.waitForTimeout(100);
  const p1 = await screen(page, tile.x, tile.y);
  const q1 = await screen(page, tile.x + 3, tile.y);
  const ratio = dist(p1, q1) / dist(p0, q0);
  expect(ratio).toBeCloseTo(2, 1);
  expect(Math.abs(p1.x - (mid.x + (p0.x - mid.x) * ratio))).toBeLessThan(3);
  expect(Math.abs(p1.y - (mid.y + (p0.y - mid.y) * ratio))).toBeLessThan(3);
  await expect(page.getByTestId('sheet')).toBeHidden();
  expect(errores).toEqual([]);
});

test('mantener y arrastrar elige a todos; en modo combate, mantener pulsado los manda allí', async ({
  page,
}) => {
  const { errores, cdp } = await start(page);
  const { base, survivors } = await debug(
    page,
    (d) => ({ base: d.world.base, survivors: d.world.survivors }),
    0,
  );
  // Alejar (pellizcar cerrando los dedos) para que quepan todos en lo que deja ver la pantalla.
  const xs = survivors.map((s) => s.pos.x);
  const ys = survivors.map((s) => s.pos.y);
  const box = {
    x0: Math.min(...xs) - 1,
    y0: Math.min(...ys) - 1,
    x1: Math.max(...xs) + 1,
    y1: Math.max(...ys) + 1,
  };
  await debug(page, (d, p: Pt) => d.centerOnTile(p.x, p.y), {
    x: Math.floor((box.x0 + box.x1) / 2),
    y: Math.floor((box.y0 + box.y1) / 2),
  });
  await page.waitForTimeout(200);
  await gesture(
    page,
    cdp,
    [
      { x: 400, y: 150 },
      { x: 540, y: 150 },
    ],
    [
      { x: 450, y: 150 },
      { x: 490, y: 150 },
    ],
  );
  await page.waitForTimeout(100);

  // Mantener quieto (sale el aro) y arrastrar: el rectángulo elige a todos.
  const a = await screen(page, box.x0 - 0.5, box.y0 - 0.5);
  const b = await screen(page, box.x1 - 0.5, box.y1 - 0.5);
  await onCanvas(page, a, b);
  await gesture(page, cdp, [a], [b], 8, 700);
  const group = page.getByTestId('group-panel');
  await expect(group).toBeVisible();
  await expect(group.locator('[data-testid^="group-name-"]')).toHaveCount(survivors.length);

  // En modo combate (su botón) y mantener pulsado a unas casillas de la puerta: van allí.
  await page.getByTestId('group-draft').tap();
  for (const s of survivors) await expect(page.getByTestId(`card-${s.id}`)).toHaveClass(/drafted/);
  const goal = { x: base.door.x, y: base.door.y + 4 };
  await debug(page, (d, p: Pt) => d.centerOnTile(p.x, p.y), goal);
  await page.waitForTimeout(200);
  const g = await screen(page, goal.x, goal.y);
  await onCanvas(page, g);
  await gesture(page, cdp, [g], [g], 1, 700);
  expect((await debug(page, (d) => d.world.orders.map((o) => o.type), 0)).at(-1)).toBe('draftMove');
  expect(errores).toEqual([]);
});

test('mantener pulsada una tarjeta añade a ese colono a los elegidos', async ({ page }) => {
  const { errores, cdp } = await start(page);
  const survivors = await debug(page, (d) => d.world.survivors, 0);
  const [s1, s2] = [survivors[0]!, survivors[1]!];
  await page.getByTestId(`card-${s1.id}`).tap();
  await expect(page.getByTestId('sheet')).toBeVisible();
  const r = (await page.getByTestId(`card-${s2.id}`).boundingBox())!;
  const c = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  await gesture(page, cdp, [c], [c], 1, 700);
  await expect(page.getByTestId(`card-${s1.id}`)).toHaveClass(/selected/);
  await expect(page.getByTestId(`card-${s2.id}`)).toHaveClass(/selected/);
  await expect(page.getByTestId('group-panel')).toBeVisible();
  expect(errores).toEqual([]);
});

test('en el mapa del mundo: pellizcar acerca y tocar un hexágono abre su ficha', async ({
  page,
}) => {
  const { errores, cdp } = await start(page);
  await page.getByTestId('map-tab--1').tap();
  const baseHex = await debug(page, (d) => d.world.common.atlas.base, 0);
  await debug(page, (d, h: number) => d.centerOnHex(h), baseHex);
  await page.waitForTimeout(200);
  const near = baseHex + 2;
  const p0 = await debug(page, (d, h: number) => d.hexToScreen(h), baseHex);
  const q0 = await debug(page, (d, h: number) => d.hexToScreen(h), near);
  await onCanvas(page, { x: 380, y: 160 }, { x: 560, y: 160 });
  await gesture(
    page,
    cdp,
    [
      { x: 420, y: 160 },
      { x: 520, y: 160 },
    ],
    [
      { x: 395, y: 160 },
      { x: 545, y: 160 },
    ],
  );
  await page.waitForTimeout(100);
  const p1 = await debug(page, (d, h: number) => d.hexToScreen(h), baseHex);
  const q1 = await debug(page, (d, h: number) => d.hexToScreen(h), near);
  expect(dist(p1, q1) / dist(p0, q0)).toBeCloseTo(1.5, 1);

  await onCanvas(page, p1);
  await page.touchscreen.tap(p1.x, p1.y);
  await expect(page.getByTestId('world-card')).toBeVisible();
  expect(errores).toEqual([]);
});
