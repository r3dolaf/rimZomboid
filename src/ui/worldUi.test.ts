// @vitest-environment jsdom
// H5c2 §6: la pestaña «🌍 Mundo» y lo que dibuja la escena del mundo (lo que no es Phaser): dónde
// cae cada hexágono en pantalla, qué hexágono hay bajo el ratón, los sitios y los grupos que viajan.
import { expect, test } from 'vitest';
import { hexCenter } from '../sim/atlas/hex';
import { findRoute } from '../sim/atlas/route';
import { HEX_HOURS } from '../sim/balance';
import { hexToward } from '../sim/expeditions';
import { addSurvivor, emptyWorld, moveTo, siteForTest, travelFor } from '../sim/testing/fixtures';
import type { SiteInfo, World } from '../sim/types';
import { mountExpeditionsPanel } from './expeditionsPanel';
import { createFlag } from './flag';
import { createMapView, mapTabs, mountMapTabs, WORLD_MAP } from './mapView';
import { createRoutePlan } from './routePlan';
import { mountWorldCard } from './worldPanel';
import {
  atlasPixels,
  HEX_PX,
  hexAtPixel,
  hexCorners,
  hexPixel,
  worldGroups,
  worldSites,
} from './worldView';

const site = (base: World, id: number, over: Partial<SiteInfo> = {}): SiteInfo => {
  const s: SiteInfo = {
    id,
    kind: 'farm',
    special: null,
    side: 0,
    hours: 4,
    state: 'known',
    visited: false,
    specialUntil: null,
    leftAt: null,
    extraZombies: 0,
    hex: hexToward(base.common.atlas, base.common.atlas.base, 0, id),
    ...over,
  };
  base.common.expedition.sites.push(s);
  return s;
};

test('cada hexágono en su sitio de la pantalla, y al revés: el hexágono bajo un punto', () => {
  const { atlas } = emptyWorld(10, 10).common;
  const first = hexPixel(atlas, 0);
  expect(first.x).toBeCloseTo((Math.sqrt(3) / 2) * HEX_PX, 6); // entero, sin cortar
  expect(first.y).toBeCloseTo(HEX_PX, 6);
  const c = hexCenter(atlas, 75);
  expect(hexPixel(atlas, 75).x - first.x).toBeCloseTo(c.x * HEX_PX, 6);
  for (let i = 0; i < atlas.width * atlas.height; i += 7) {
    const p = hexPixel(atlas, i);
    expect(hexAtPixel(atlas, p.x, p.y)).toBe(i);
    expect(hexAtPixel(atlas, p.x + HEX_PX * 0.4, p.y - HEX_PX * 0.4)).toBe(i); // dentro, cerca
  }
  expect(hexAtPixel(atlas, -50, -50)).toBe(-1);
  const size = atlasPixels(atlas);
  expect(hexAtPixel(atlas, size.width + 50, 10)).toBe(-1);
  const last = hexPixel(atlas, atlas.width * atlas.height - 1);
  expect(size.width).toBeGreaterThanOrEqual(last.x + HEX_PX * 0.86);
  expect(size.height).toBeGreaterThanOrEqual(last.y + HEX_PX);
  // Las seis esquinas, con punta arriba y abajo.
  const k = hexCorners(0, 0, 10);
  expect(k).toHaveLength(6);
  expect(Math.min(...k.map((p) => p.y))).toBeCloseTo(-10, 6);
  expect(Math.max(...k.map((p) => p.y))).toBeCloseTo(10, 6);
});

test('los sitios del mundo: la base y los conocidos (no los ocultos), con su gente', () => {
  const base = emptyWorld(10, 10);
  const farm = site(base, 4);
  site(base, 5, { kind: 'gas', state: 'hidden' });
  const lost = site(base, 6, { kind: 'house', state: 'lost' });
  const m = siteForTest(base, 4);
  moveTo(base, m, base.survivors[0]!);
  const marks = worldSites(base);
  expect(marks.map((x) => x.siteId)).toEqual([null, 4, 6]);
  expect(marks[0]).toMatchObject({ hex: base.common.atlas.base, label: 'Base', people: 0 });
  expect(marks[1]).toMatchObject({ hex: farm.hex, label: 'Granja del norte', people: 1 });
  expect(marks[1]!.lost).toBe(false);
  expect(marks[2]).toMatchObject({ hex: lost.hex, lost: true, people: 0 });
  expect(new Set(marks.map((x) => x.icon)).size).toBe(3); // cada tipo, su icono
});

test('los grupos que viajan: entre el hexágono en que están y el siguiente; los que aún no salen, no', () => {
  const base = emptyWorld(10, 10);
  const { atlas } = base.common;
  const ana = base.survivors[0]!;
  const bea = addSurvivor(base, { x: 3, y: 3 }, 'Bea');
  base.survivors = [];
  const to = hexToward(atlas, atlas.base, 3, 3);
  const t = travelFor(base, {
    kind: 'go',
    from: atlas.base,
    to,
    members: [ana, bea],
    hoursLeft: HEX_HOURS.field / 4,
  });
  base.common.expedition.travels.push(t, { ...t, id: 51, members: [], pending: [9] });
  const [g, ...rest] = worldGroups(base);
  expect(rest).toEqual([]);
  const a = hexPixel(atlas, t.path[t.at]!);
  const b = hexPixel(atlas, t.path[t.at + 1]!);
  expect(g).toMatchObject({ travelId: t.id, people: 2 });
  expect(g!.x).toBeCloseTo(a.x + (b.x - a.x) * 0.75, 6); // tres cuartos del camino
  expect(g!.y).toBeCloseTo(a.y + (b.y - a.y) * 0.75, 6);
  expect(g!.label).toContain('Ana');
});

test('la pestaña «🌍 Mundo», siempre al final; al pulsarla se ve el mundo (y la base detrás)', () => {
  const base = emptyWorld(10, 10);
  site(base, 4);
  const m = siteForTest(base, 4);
  moveTo(base, m, base.survivors[0]!);
  addSurvivor(base, { x: 2, y: 2 }, 'Bea');
  expect(mapTabs(base).map((t) => t.mapId)).toEqual([0, 4, WORLD_MAP]);
  expect(mapTabs(base).at(-1)!.label).toBe('🌍 Mundo');
  const view = createMapView(base);
  const root = document.createElement('div');
  const tabs = mountMapTabs(root, { view });
  tabs.update();
  const bar = root.querySelector('[data-testid="map-tabs"]') as HTMLElement;
  expect(bar.hidden).toBe(false);
  const changes: number[] = [];
  view.onChange((id) => changes.push(id));
  (root.querySelector(`[data-testid="map-tab-${WORLD_MAP}"]`) as HTMLElement).click();
  expect(view.mapId).toBe(WORLD_MAP);
  expect(view.atlas).toBe(true);
  expect(view.world).toBe(base);
  expect(changes).toEqual([WORLD_MAP]);
  tabs.update();
  expect(view.mapId).toBe(WORLD_MAP); // no se va a la base sola
  view.set(4);
  expect(view.atlas).toBe(false);
});

test('la ruta que se planea: de dónde a dónde; arrastrar un punto pone o mueve una parada; el botón derecho la quita', () => {
  const { atlas } = emptyWorld(10, 10).common;
  const plan = createRoutePlan();
  expect(plan.route(atlas)).toBeNull();
  const to = hexToward(atlas, atlas.base, 3, 6);
  plan.set(atlas.base, to);
  const straight = plan.route(atlas)!;
  expect(straight).toEqual(findRoute(atlas, atlas.base, to));
  const north = hexToward(atlas, straight[3]!, 0, 3);
  expect(plan.drag(atlas, 3, north)).toBe(true);
  expect(plan.waypoints).toEqual([north]);
  const bent = plan.route(atlas)!;
  expect(bent).toContain(north);
  expect(bent.at(-1)).toBe(to);
  // Otra parada antes de la primera, en su orden; y arrastrar una parada la mueve.
  const k = bent.indexOf(north);
  const south = hexToward(atlas, bent[1]!, 1, 2);
  expect(plan.drag(atlas, 1, south)).toBe(true);
  expect(plan.waypoints).toEqual([south, north]);
  const moved = hexToward(atlas, north, 3, 1);
  expect(plan.drag(atlas, plan.route(atlas)!.indexOf(north), moved)).toBe(true);
  expect(plan.waypoints).toEqual([south, moved]);
  expect(k).toBeGreaterThan(0);
  // En el agua (sin puente) no se puede.
  atlas.terrain[north] = 'water';
  atlas.seen[north] = 1;
  expect(plan.drag(atlas, 2, north)).toBe(false);
  expect(plan.waypoints).toEqual([south, moved]);
  expect(plan.remove(south)).toBe(true);
  expect(plan.remove(south)).toBe(false);
  expect(plan.waypoints).toEqual([moved]);
  plan.set(atlas.base, to); // los mismos extremos: se quedan las paradas
  expect(plan.waypoints).toEqual([moved]);
  plan.set(atlas.base, hexToward(atlas, atlas.base, 2, 4)); // otro destino: sin paradas
  expect(plan.waypoints).toEqual([]);
});

/** La base con Ana y Bea, la granja (sitio 4) con Carla y un grupo (Dani) de camino a ella. */
function cardGame() {
  const base = emptyWorld(10, 10);
  const { atlas } = base.common;
  const ana = base.survivors[0]!;
  addSurvivor(base, { x: 2, y: 2 }, 'Bea');
  const carla = addSurvivor(base, { x: 3, y: 3 }, 'Carla');
  const dani = addSurvivor(base, { x: 4, y: 4 }, 'Dani');
  const farm = site(base, 4);
  const gas = site(base, 5, { kind: 'gas', hex: hexToward(atlas, atlas.base, 3, 5) });
  for (const s of [farm, gas]) atlas.seen[s.hex] = 1; // al descubrirlos se ve su hexágono
  const m = siteForTest(base, 4);
  moveTo(base, m, carla);
  base.survivors = base.survivors.filter((s) => s !== dani);
  const t = travelFor(base, {
    kind: 'go',
    from: atlas.base,
    to: farm.hex,
    siteId: 4,
    members: [dani],
    hoursLeft: 0.5,
    id: 70,
  });
  t.at = 1;
  base.common.expedition.travels.push(t);
  const view = createMapView(base);
  view.set(WORLD_MAP); // la ficha solo se ve con el mapa del mundo
  const plan = createRoutePlan();
  const sent: number[] = [];
  const explored: number[] = [];
  const root = document.createElement('div');
  const card = mountWorldCard(root, {
    world: base,
    view,
    plan,
    onSend: (id) => sent.push(id),
    onExplore: (hex) => explored.push(hex),
  });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;
  return { base, atlas, ana, farm, gas, t, view, plan, sent, explored, card, q };
}

test('la ficha de un hexágono: qué hay, a cuánto de la base y sus botones', () => {
  const { base, atlas, farm, gas, view, sent, explored, card, q } = cardGame();
  card.hex(farm.hex);
  card.update();
  expect(q('world-card')!.hidden).toBe(false);
  expect(q('world-card')!.textContent).toContain('Granja del norte');
  expect(q('world-card')!.textContent).toContain('Campo');
  expect(q('world-card')!.textContent).toContain('1 persona');
  q('world-card-send')!.click();
  expect(sent).toEqual([4]);
  q('world-card-go')!.click();
  expect(view.mapId).toBe(4);
  card.update();
  expect(q('world-card')!.hidden).toBe(true); // fuera del mapa del mundo no se ve
  view.set(WORLD_MAP);
  card.update();
  expect(q('world-card')!.hidden).toBe(false);
  expect(q('world-card-explore')).toBeNull(); // hay un sitio
  card.hex(gas.hex);
  card.update();
  expect(q('world-card-go')).toBeNull(); // sin gente
  expect(q('world-card')!.textContent).toMatch(/a 5 hexágonos de la base/);
  // Un hexágono sin sitio (o en la niebla): explorar.
  const empty = hexToward(atlas, atlas.base, 2, 6);
  card.hex(empty);
  card.update();
  expect(q('world-card')!.textContent).toContain('Sin explorar');
  expect(q('world-card-send')).toBeNull();
  q('world-card-explore')!.click();
  expect(explored).toEqual([empty]);
  card.hex(atlas.base);
  card.update();
  expect(q('world-card')!.textContent).toContain('Base');
  expect(q('world-card-explore')).toBeNull();
  q('world-card-close')!.click();
  card.update();
  expect(q('world-card')!.hidden).toBe(true);
  expect(card.selected).toBe(-1);
  expect(base.orders).toEqual([]);
});

test('la ficha de un grupo: a dónde va; volver a la base o cambiar de destino eligiendo en el mapa', () => {
  const { base, atlas, gas, t, plan, card, q } = cardGame();
  card.group(t.id);
  card.update();
  expect(q('world-card')!.textContent).toContain('Dani');
  expect(q('world-card')!.textContent).toContain('Viajando a la granja del norte');
  q('world-card-home')!.click();
  expect(base.orders).toContainEqual({ type: 'redirectTravel', travelId: t.id, siteId: null });
  base.orders = [];
  q('world-card-redirect')!.click();
  card.update();
  expect(q('world-card')!.textContent).toContain('Pulsa un sitio');
  card.hex(hexToward(atlas, atlas.base, 2, 6)); // ahí no hay sitio: nada
  card.update();
  expect(q('world-card-confirm')).toBeNull();
  card.hex(gas.hex);
  card.update();
  expect(plan.from).toBe(t.path[t.at]);
  expect(plan.to).toBe(gas.hex);
  q('world-card-confirm')!.click();
  expect(base.orders).toEqual([
    { type: 'redirectTravel', travelId: t.id, siteId: gas.id, waypoints: [] },
  ]);
  card.update();
  expect(plan.from).toBeNull(); // hecho: nada que planear
});

/** El panel Expediciones abierto sobre `cardGame` (con su ruta y «Ver en el mapa»). */
function panelGame() {
  const g = cardGame();
  const root = document.createElement('div');
  const open = createFlag();
  open.set(true);
  const shown: number[] = [];
  const panel = mountExpeditionsPanel(root, {
    world: g.base,
    open,
    plan: g.plan,
    onShowHex: (hex) => shown.push(hex),
  });
  panel.update();
  const q = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector(`[data-testid="${id}"]`) as T;
  const pick = (id: string, value: string) => {
    q<HTMLSelectElement>(id).value = value;
    q<HTMLSelectElement>(id).dispatchEvent(new Event('change', { bubbles: true }));
    panel.update();
  };
  return { ...g, root, open, panel, q, pick, shown };
}

test('Expediciones: mandar desde un sitio con gente (cargan lo del campamento), con la ruta y sus paradas', () => {
  const { base, atlas, farm, gas, plan, panel, q, pick } = panelGame();
  const carla = base.siteMaps[0]!.world.survivors[0]!;
  const from = q<HTMLSelectElement>('expedition-from');
  expect([...from.options].map((o) => o.textContent)).toEqual(['Base', 'Granja del norte']);
  pick('expedition-from', '4');
  expect(q(`expedition-member-${carla.id}`)).not.toBeNull();
  expect(q('expedition-form').textContent).toContain('cargan lo que puedan del campamento');
  expect(q('expedition-list')).toBeNull(); // sin lista del almacén
  const dest = q<HTMLSelectElement>('expedition-site');
  expect([...dest.options].map((o) => o.value)).toEqual(['', '5']); // no a donde ya están
  panel.chooseSite(gas.id);
  panel.update();
  expect(plan.from).toBe(farm.hex);
  expect(plan.to).toBe(gas.hex);
  const r = plan.route(atlas)!;
  const stop = hexToward(atlas, r[1]!, 1, 1);
  expect(plan.drag(atlas, 1, stop)).toBe(true);
  q(`expedition-member-${carla.id}`).click();
  panel.update();
  q('expedition-send').click();
  expect(base.orders).toContainEqual({
    type: 'sendExpedition',
    from: 4,
    siteId: gas.id,
    survivorIds: [carla.id],
    items: {},
    waypoints: [stop],
  });
});

test('Expediciones: explorar una zona elegida en el mapa; «Ver en el mapa» en sitios y viajes', () => {
  const { base, atlas, ana, farm, t, plan, panel, q, shown } = panelGame();
  const zone = hexToward(atlas, atlas.base, 2, 7);
  panel.exploreAt(zone);
  panel.update();
  expect(q<HTMLSelectElement>('explore-side').value).toBe('map');
  expect(plan.from).toBe(atlas.base);
  expect(plan.to).toBe(zone);
  q(`explore-member-${ana.id}`).click();
  panel.update();
  q('explore-send').click();
  expect(base.orders).toContainEqual({ type: 'explore', target: zone, survivorIds: [ana.id] });
  q('site-4-map').click();
  q(`travel-${t.id}-map`).click();
  expect(shown).toEqual([farm.hex, t.path[t.at]]);
});
