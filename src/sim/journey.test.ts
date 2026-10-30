// H5c2 §4–§5: viajar por el mundo hexágono a hexágono (de día), despejando la niebla; rehacer la
// ruta si aparece agua; salir y entrar por el lado de la ruta; explorar con vuelta; mandar desde un
// sitio; cambiar de destino.
import { expect, test } from 'vitest';
import { EXPLORE_RADIUS, HEX_HOURS, TICKS_PER_HOUR } from './balance';
import { dayStart } from './clock';
import { hexesWithin, hexIndex, sideFrom } from './atlas/hex';
import { exitTile, hexToward } from './expeditions';
import { mapById, stepGame } from './game';
import { checkInvariants } from './invariants';
import { issue, ordersSystem } from './orders';
import { addSurvivor, emptyWorld, moveTo, siteForTest } from './testing/fixtures';
import { Tile, type SiteInfo, type Survivor, type World } from './types';

/** Base de 20×20 con suelo; Ana y Bea sin trabajo; un sitio conocido (id 1) al este. */
function world(): { w: World; ana: Survivor; bea: Survivor; site: SiteInfo } {
  const w = emptyWorld(20, 20);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 5, y: 5 }];
  w.base.door = { x: 10, y: 10 };
  const bea = addSurvivor(w, { x: 8, y: 8 }, 'Bea');
  for (const s of w.survivors) {
    s.pos = { x: 8.5, y: 8.5 };
    for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
    s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
    s.nextChatAt = 1e9;
  }
  const { atlas } = w.common;
  const hex = hexToward(atlas, atlas.base, 3, 5); // 5 hexágonos al este
  const site: SiteInfo = {
    id: 1,
    kind: 'farm',
    special: null,
    hex,
    side: 3,
    hours: 5,
    state: 'known',
    visited: false,
    specialUntil: null,
    leftAt: null,
    extraZombies: 0,
  };
  w.common.expedition.sites.push(site);
  w.common.expedition.nextSiteId = 2;
  return { w, ana: w.survivors[0]!, bea, site };
}

const at = (w: World, day: number, hour: number) =>
  (w.tick = dayStart(day) + hour * TICKS_PER_HOUR);

/** Avanza hasta que todos han salido del mapa (o un límite); la orden ya procesada. */
function leave(w: World, from: World = w): void {
  for (let i = 0; i < 600 && from.survivors.some((s) => s.trip); i++) stepGame(w);
}

test('mandar un grupo: ruta de la base al sitio, por el lado del primer paso; viaja hexágono a hexágono despejando', () => {
  const { w, ana, site } = world();
  const { atlas } = w.common;
  at(w, 1, 8);
  issue(w, { type: 'sendExpedition', from: 0, siteId: site.id, survivorIds: [ana.id], items: {} });
  ordersSystem(w);
  const t = w.common.expedition.travels[0]!;
  expect(t.path[0]).toBe(atlas.base);
  expect(t.path.at(-1)).toBe(site.hex);
  expect(t.target).toBe(site.hex);
  expect(t.side).toBe(sideFrom(atlas, t.path[0]!, t.path[1]!));
  expect(t.side).toBe(3); // al este
  expect(t.hoursLeft).toBe(HEX_HOURS.field);
  leave(w);
  expect(t.members).toEqual([ana]);
  // Una hora de luz: entra en el siguiente hexágono y despeja alrededor.
  const before = t.at;
  for (let i = 0; i < TICKS_PER_HOUR; i++) stepGame(w);
  expect(t.at).toBe(before + 1);
  for (const i of hexesWithin(atlas, t.path[t.at]!, 1)) expect(atlas.seen[i]).toBe(1);
  expect(checkInvariants(w)).toEqual([]);
  // Hasta llegar: entra en el sitio por el lado del que viene (el oeste).
  for (let i = 0; i < 3 * 24 * TICKS_PER_HOUR && w.common.expedition.travels.length > 0; i++)
    stepGame(w);
  const m = mapById(w, site.id)!;
  expect(m.survivors).toEqual([ana]);
  const west = exitTile(m, 2);
  expect({ x: Math.floor(ana.pos.x), y: Math.floor(ana.pos.y) }).toEqual(west);
  expect(checkInvariants(w)).toEqual([]);
});

test('si por el camino aparece agua sin puente, rehacen la ruta desde donde están', () => {
  const { w, ana, site } = world();
  const { atlas } = w.common;
  // Un río escondido en la niebla, entre la base y el sitio, con un puente más abajo.
  const { width } = atlas;
  const baseCol = atlas.base % width;
  const baseRow = Math.floor(atlas.base / width);
  for (let r = 0; r < atlas.height; r++) {
    const i = hexIndex(atlas, baseCol + 4, r);
    atlas.terrain[i] = 'water';
    atlas.seen[i] = 0;
  }
  const bridge = hexIndex(atlas, baseCol + 4, baseRow + 6);
  atlas.road[bridge] = 1;
  at(w, 1, 8);
  issue(w, { type: 'sendExpedition', from: 0, siteId: site.id, survivorIds: [ana.id], items: {} });
  ordersSystem(w);
  leave(w);
  for (let i = 0; i < 6 * 24 * TICKS_PER_HOUR && w.common.expedition.travels.length > 0; i++)
    stepGame(w);
  expect(mapById(w, site.id)?.survivors).toEqual([ana]);
  for (const i of hexesWithin(atlas, bridge, 0)) expect(atlas.seen[i]).toBe(1); // pasaron por el puente
});

test('explorar un hexágono: van, despejan alrededor (y descubren), y vuelven solos a la base', () => {
  const { w, ana } = world();
  const { atlas } = w.common;
  const target = hexToward(atlas, atlas.base, 0, 6); // 6 al norte
  const hidden: SiteInfo = {
    id: 2,
    kind: 'house',
    special: null,
    hex: hexToward(atlas, target, 3, 2),
    side: 0,
    hours: 0,
    state: 'hidden',
    visited: false,
    specialUntil: null,
    leftAt: null,
    extraZombies: 0,
  };
  w.common.expedition.sites.push(hidden);
  at(w, 1, 8);
  issue(w, { type: 'explore', target, survivorIds: [ana.id] });
  ordersSystem(w);
  leave(w);
  const t = w.common.expedition.travels[0]!;
  expect(t).toMatchObject({ kind: 'explore', target, side: 0 });
  for (let i = 0; i < 6 * 24 * TICKS_PER_HOUR && w.common.expedition.travels.length > 0; i++)
    stepGame(w);
  expect(w.survivors).toContain(ana);
  for (const i of hexesWithin(atlas, target, EXPLORE_RADIUS)) expect(atlas.seen[i]).toBe(1);
  expect(hidden.state).toBe('known');
  expect(w.common.log.find((e) => e.kind === 'siteFound')).toMatchObject({
    how: 'explore',
    survivorId: ana.id,
  });
  expect(checkInvariants(w)).toEqual([]);
});

test('mandar desde un sitio a otro, y cambiar de destino por el camino (a la base)', () => {
  const { w, ana, site } = world();
  const { atlas } = w.common;
  const m = siteForTest(w, site.id, 16, 16);
  m.grid.tiles.fill(Tile.Floor);
  m.seen.fill(1);
  moveTo(w, m, ana);
  const other: SiteInfo = { ...site, id: 2, hex: hexToward(atlas, site.hex, 0, 4) };
  w.common.expedition.sites.push(other);
  at(w, 1, 8);
  issue(w, {
    type: 'sendExpedition',
    from: site.id,
    siteId: other.id,
    survivorIds: [ana.id],
    items: {},
  });
  ordersSystem(w);
  const t = w.common.expedition.travels[0]!;
  expect(t.path[0]).toBe(site.hex);
  expect(t.path.at(-1)).toBe(other.hex);
  leave(w, m);
  expect(t.members).toEqual([ana]);
  for (let i = 0; i < TICKS_PER_HOUR; i++) stepGame(w);
  const here = t.path[t.at]!;
  issue(w, { type: 'redirectTravel', travelId: t.id, siteId: null });
  ordersSystem(w);
  const r = w.common.expedition.travels[0]!;
  expect(r).toMatchObject({ kind: 'back', siteId: null, target: atlas.base });
  expect(r.path[0]).toBe(here);
  for (let i = 0; i < 6 * 24 * TICKS_PER_HOUR && w.common.expedition.travels.length > 0; i++)
    stepGame(w);
  expect(w.survivors).toContain(ana);
  expect(checkInvariants(w)).toEqual([]);
});

test('las órdenes que no valen no hacen nada: sitio oculto, sin camino, hexágono fuera del mundo', () => {
  const { w, ana, site } = world();
  const { atlas } = w.common;
  site.state = 'hidden';
  issue(w, { type: 'sendExpedition', from: 0, siteId: site.id, survivorIds: [ana.id], items: {} });
  issue(w, { type: 'explore', target: -5, survivorIds: [ana.id] });
  ordersSystem(w);
  expect(w.common.expedition.travels).toEqual([]);
  site.state = 'known';
  for (const i of hexesWithin(atlas, site.hex, 1)) if (i !== site.hex) atlas.terrain[i] = 'water';
  for (const i of hexesWithin(atlas, site.hex, 1)) atlas.seen[i] = 1;
  issue(w, { type: 'sendExpedition', from: 0, siteId: site.id, survivorIds: [ana.id], items: {} });
  ordersSystem(w);
  expect(w.common.expedition.travels).toEqual([]); // rodeado de agua: sin camino
  expect(ana.trip).toBeNull();
});

test('las comprobaciones del juego: la ruta de cada viaje, de vecino en vecino y hasta su destino', () => {
  const { w, ana, site } = world();
  issue(w, { type: 'sendExpedition', from: 0, siteId: site.id, survivorIds: [ana.id], items: {} });
  ordersSystem(w);
  const t = w.common.expedition.travels[0]!;
  expect(checkInvariants(w)).toEqual([]);
  const has = (text: string) => checkInvariants(w).some((p) => p.includes(text));
  t.at = t.path.length;
  expect(has('fuera de su ruta')).toBe(true);
  t.at = 0;
  t.target = w.common.atlas.base;
  expect(has('no acaba en su destino')).toBe(true);
  t.target = site.hex;
  t.path.splice(1, 1);
  expect(has('salta de')).toBe(true);
});
