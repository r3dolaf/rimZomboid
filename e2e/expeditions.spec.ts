import { expect, test, type Page } from '@playwright/test';

// H5c1: descubrir un sitio, mandar un grupo desde el panel Expediciones, ver la pestaña del sitio,
// cambiar de mapa con una tarjeta y volver a la base.

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
    siteMaps: { siteId: number; world: { survivors: Survivor[]; zombies: unknown[] } }[];
    common: { expedition: { sites: { id: number; hours: number }[] } };
  };
  view: { mapId: number };
  discoverSite(o: { how: string; side?: number; special?: null }): { id: number } | null;
}

const mapId = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.view.mapId);

const inBase = (page: Page, id: number) =>
  page.evaluate(
    (id) =>
      (window as unknown as { rimzomboid: Debug }).rimzomboid.world.survivors.some(
        (s) => s.id === id,
      ),
    id,
  );

/**
 * Quien sale de ese mapa (la base, `null`, o un sitio) y ya va hacia el borde: se le pone allí
 * (el mapa es grande y por el camino puede huir de algún zombi).
 */
async function nearTheEdge(page: Page, siteId: number | null) {
  await expect
    .poll(
      () =>
        page.evaluate((siteId) => {
          const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
          const list =
            siteId === null
              ? w.survivors
              : (w.siteMaps.find((m) => m.siteId === siteId)?.world.survivors ?? []);
          const s = list.find((x) => x.trip?.stage === 'exit' && x.action.type === 'moveTo');
          const t = s?.action.target;
          if (!s || !t) return false;
          s.pos = { x: t.x + 0.5, y: t.y + 0.5 };
          s.path = [];
          return true;
        }, siteId),
      { timeout: 60_000 },
    )
    .toBe(true);
}

test('expediciones: descubrir un sitio, mandar a alguien, verlo en su pestaña y volver', async ({
  page,
}) => {
  test.setTimeout(180_000); // un viaje de ida y vuelta, más lento si hay otras pruebas a la vez
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=5&debug=1');
  await page.locator('[data-speed="0"]').click();
  // Un sitio hacia el norte, cerca (por depuración); van el primero, se queda el segundo.
  const { site, first, other } = await page.evaluate(() => {
    const d = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    const s = d.discoverSite({ how: 'roadMap', side: 0, special: null })!;
    d.world.common.expedition.sites.find((x) => x.id === s.id)!.hours = 0.2;
    return { site: s.id, first: d.world.survivors[0]!.id, other: d.world.survivors[1]!.id };
  });

  // El panel: el sitio, quién va y Salir (en pausa ya se ve que saldrán).
  await page.getByTestId('hud-expeditions').click();
  await expect(page.getByTestId(`site-${site}`)).toContainText('sin visitar');
  await page.getByTestId(`site-${site}-pick`).click();
  await page.getByTestId(`expedition-member-${first}`).check();
  await page.getByTestId('expedition-send').click();
  await expect(page.getByTestId('expeditions-travels')).toContainText('saldrán hacia');
  await page.keyboard.press('Escape');

  // Sale, viaja y llega: aparece la pestaña del sitio y su tarjeta dice dónde está.
  await page.locator('[data-speed="3"]').click();
  await nearTheEdge(page, null);
  await expect(page.getByTestId(`map-tab-${site}`)).toBeVisible({ timeout: 60_000 });
  // Sin los zombis del sitio: aquí se prueba la pantalla, no la pelea.
  await page.evaluate((site) => {
    const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
    w.siteMaps.find((m) => m.siteId === site)!.world.zombies = [];
  }, site);
  await expect(page.getByTestId(`card-${first}`)).toContainText(/En (la|el) /);

  // Pulsar su tarjeta lleva a su mapa; la de otro, a la base.
  await page.getByTestId(`card-${first}`).click();
  await expect.poll(() => mapId(page)).toBe(site);
  await expect(page.getByTestId(`map-tab-${site}`)).toHaveClass(/active/);
  await page.getByTestId(`card-${other}`).click();
  await expect.poll(() => mapId(page)).toBe(0);

  // Volver, desde el panel: sale del sitio (la pestaña se va) y llega a la base.
  await page.getByTestId('hud-expeditions').click();
  await page.getByTestId(`site-${site}-return`).click();
  await nearTheEdge(page, site);
  await expect(page.getByTestId(`map-tab-${site}`)).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => inBase(page, first), { timeout: 60_000 }).toBe(true);
  expect(errores).toEqual([]);
});
