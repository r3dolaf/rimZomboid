import { expect, test, type Page } from '@playwright/test';

// H5c2: la pestaña «🌍 Mundo»: pulsar un sitio, «Mandar grupo aquí», ajustar la ruta con una parada,
// salir, pulsar el grupo por el camino y hacerle volver a la base.

interface Survivor {
  id: number;
  pos: { x: number; y: number };
  path: unknown[];
  trip: { stage: string } | null;
  action: { type: string; target?: { x: number; y: number } };
}
interface Debug {
  world: {
    survivors: Survivor[];
    orders: { type: string; waypoints?: number[] }[];
    common: {
      atlas: { base: number; width: number };
      expedition: { travels: { id: number; kind: string; members: unknown[] }[] };
    };
  };
  discoverSite(o: { how: string; side?: number; special?: null }): { id: number } | null;
  siteNear(id: number, side: number, dist: number): number | null;
  hexToScreen(i: number): { x: number; y: number };
  groupToScreen(id: number): { x: number; y: number } | null;
  plannedRoute(): number[] | null;
  centerOnHex(i: number): void;
}

const debug = <T>(page: Page, fn: (d: Debug, arg: number) => T, arg = 0) =>
  page.evaluate(
    ([f, a]) => {
      const d = (window as unknown as { rimzomboid: Debug }).rimzomboid;
      return (new Function('d', 'a', `return (${f})(d, a)`) as (d: Debug, a: number) => T)(d, a);
    },
    [fn.toString(), arg] as const,
  );

test('mapa del mundo: mandar un grupo desde la ficha, con una parada, y hacerle volver', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=5&debug=1');
  await page.locator('[data-speed="0"]').click();
  // Un sitio conocido a 4 hexágonos al este (por depuración).
  const site = await debug(page, (d) => d.discoverSite({ how: 'note', special: null })!.id);
  const hex = (await debug(page, (d, id) => d.siteNear(id, 3, 4), site))!;
  const first = await debug(page, (d) => d.world.survivors[0]!.id);

  // La pestaña del mundo; pulsar el sitio abre su ficha.
  await page.getByTestId('map-tab--1').click();
  await debug(page, (d, h) => d.centerOnHex(h), hex);
  const at = await debug(page, (d, h) => d.hexToScreen(h), hex);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId('world-card')).toBeVisible();
  await page.getByTestId('world-card-send').click();
  await expect(page.getByTestId('expeditions-panel')).toBeVisible();
  await expect(page.getByTestId('expedition-site')).toHaveValue(String(site));

  // La ruta: arrastrar su segundo punto dos filas más arriba pone una parada.
  const second = (await debug(page, (d) => d.plannedRoute()))![1]!;
  await debug(page, (d, h) => d.centerOnHex(h), second);
  const from = await debug(page, (d, h) => d.hexToScreen(h), second);
  const to = await debug(page, (d, h) => d.hexToScreen(h - 2 * d.world.common.atlas.width), second);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 12, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  await page.getByTestId(`expedition-member-${first}`).check();
  await page.getByTestId('expedition-send').click();
  await expect(page.getByTestId('expeditions-travels')).toContainText('saldrán hacia');
  const stops = await debug(page, (d) => d.world.orders.find((o) => o.type === 'sendExpedition')!);
  expect(stops.waypoints).toHaveLength(1);

  // Sale (se le pone en el borde) y viaja: se pulsa el grupo y «Volver a la base».
  await page.locator('[data-speed="3"]').click();
  await expect
    .poll(
      () =>
        debug(page, (d) => {
          const s = d.world.survivors.find((x) => x.trip?.stage === 'exit' && x.action.target);
          if (s) {
            const t = s.action.target!;
            s.pos = { x: t.x + 0.5, y: t.y + 0.5 };
            s.path = [];
          }
          return d.world.common.expedition.travels.some((t) => t.members.length > 0);
        }),
      { timeout: 60_000 },
    )
    .toBe(true);
  await page.locator('[data-speed="0"]').click();
  const travel = await debug(page, (d) => d.world.common.expedition.travels[0]!.id);
  const g = (await debug(page, (d, id) => d.groupToScreen(id), travel))!;
  await page.mouse.click(g.x, g.y);
  await expect(page.getByTestId('world-card')).toContainText('Viajando');
  await page.getByTestId('world-card-home').click();
  await page.locator('[data-speed="3"]').click();
  await expect
    .poll(() => debug(page, (d, id) => d.world.survivors.some((s) => s.id === id), first), {
      timeout: 90_000,
    })
    .toBe(true);
  expect(errores).toEqual([]);
});
