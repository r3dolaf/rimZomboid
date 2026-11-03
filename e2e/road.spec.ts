import { expect, test, type Page } from '@playwright/test';

// H5c3: por el camino, una horda (por depuración): el grupo se para, su ficha en el mapa del mundo
// lo dice y se contesta desde allí; atraviesan y siguen.

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
    common: {
      log: { kind: string; horde?: boolean }[];
      expedition: {
        travels: {
          id: number;
          members: unknown[];
          waiting?: number;
          at: number;
          path: number[];
          nextEventAt?: number;
        }[];
      };
    };
  };
  discoverSite(o: { how: string; special?: null }): { id: number } | null;
  siteNear(id: number, side: number, dist: number): number | null;
  roadEvent(travelId: number, kind: string): void;
  groupToScreen(id: number): { x: number; y: number } | null;
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

test('el camino: una horda delante; se contesta desde la ficha del grupo y la atraviesan', async ({
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
  const site = await debug(page, (d) => d.discoverSite({ how: 'note', special: null })!.id);
  await debug(page, (d, id) => d.siteNear(id, 3, 8), site);
  const first = await debug(page, (d) => d.world.survivors[0]!.id);

  // Mandar a uno: la comida del viaje ya va en la lista.
  await page.getByTestId('hud-expeditions').click();
  await page.getByTestId(`site-${site}-pick`).click();
  await page.getByTestId(`expedition-member-${first}`).check();
  await expect(page.getByTestId('expedition-food')).toContainText('latas por persona');
  await page.getByTestId('expedition-send').click();
  await page.keyboard.press('Escape');

  // Sale (se le pone en el borde) y, en cuanto va de camino, una horda delante.
  await page.locator('[data-speed="3"]').click();
  await expect
    .poll(
      () =>
        debug(page, (d) => {
          // Solo la horda que se pone a mano (H5c3): sin otros sucesos.
          for (const t of d.world.common.expedition.travels) t.nextEventAt = 1e12;
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
  await debug(page, (d, id) => d.roadEvent(id, 'horde'), travel);
  await expect(page.getByTestId('decision-horde')).toBeVisible();

  // En el mapa del mundo: el grupo espera; su ficha lo dice y se contesta allí.
  await page.getByTestId('map-tab--1').click();
  const hex = await debug(page, (d) => {
    const t = d.world.common.expedition.travels[0]!;
    return t.path[t.at]!;
  });
  await debug(page, (d, h) => d.centerOnHex(h), hex);
  const g = (await debug(page, (d, id) => d.groupToScreen(id), travel))!;
  await page.mouse.click(g.x, g.y);
  await expect(page.getByTestId('world-card')).toContainText('Esperando: una horda delante');
  await page.getByTestId('world-card-decide-1').click(); // atravesar
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(
      () =>
        debug(page, (d) => d.world.common.log.some((e) => e.kind === 'roadZombies' && !!e.horde)),
      { timeout: 30_000 },
    )
    .toBe(true);
  expect(
    await debug(page, (d) => d.world.common.expedition.travels[0]?.waiting ?? null),
  ).toBeNull();
  expect(errores).toEqual([]);
});
