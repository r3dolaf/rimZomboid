// @vitest-environment jsdom
// H5c2 §6: la pestaña «🌍 Mundo» y lo que dibuja la escena del mundo (lo que no es Phaser): dónde
// cae cada hexágono en pantalla, qué hexágono hay bajo el ratón, los sitios y los grupos que viajan.
import { expect, test } from 'vitest';
import { hexCenter } from '../sim/atlas/hex';
import { HEX_HOURS } from '../sim/balance';
import { hexToward } from '../sim/expeditions';
import { addSurvivor, emptyWorld, moveTo, siteForTest, travelFor } from '../sim/testing/fixtures';
import type { SiteInfo, World } from '../sim/types';
import { createMapView, mapTabs, mountMapTabs, WORLD_MAP } from './mapView';
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
