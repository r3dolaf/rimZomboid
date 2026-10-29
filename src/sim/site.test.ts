// H5c1 §2: el mapa de un sitio, con las recetas del pueblo (H4f): edificios, botín, zombis y
// el campamento junto a la entrada.
import { expect, test } from 'vitest';
import { SITE_SIZE, SITE_ZOMBIES, TICKS_PER_DAY, VILLAGE_SIZE } from './balance';
import { checkInvariants } from './invariants';
import { generateSite } from './map/site';
import { getTile } from './map/grid';
import { findPath } from './path/astar';
import { createRng } from './rng';
import { siteMap, sitesDailySystem, survivorsSystem } from './sites';
import { issue, ordersSystem } from './orders';
import { emptyWorld } from './testing/fixtures';
import { Tile, type MapSide, type SiteInfo, type SiteKind } from './types';

const info = (over: Partial<SiteInfo> = {}): SiteInfo => ({
  id: 1,
  kind: 'farm',
  special: null,
  side: 0,
  hours: 4,
  state: 'known',
  visited: false,
  specialUntil: null,
  leftAt: null,
  extraZombies: 0,
  ...over,
});

test('cada tipo de sitio: su tamaño y sus edificios, alcanzables desde la entrada', () => {
  const kinds: [SiteKind, string[]][] = [
    ['house', ['house']],
    ['farm', ['farm', 'house']],
    ['gas', ['gas']],
    ['warehouse', ['warehouse']],
  ];
  for (const [kind, buildings] of kinds)
    for (const side of [0, 1, 2, 3] as MapSide[]) {
      const m = generateSite(kind, null, side, createRng(side + 7));
      expect(m.grid.width).toBe(SITE_SIZE);
      expect(m.houses.map((h) => h.kind).sort()).toEqual([...buildings].sort());
      for (const e of m.entry) {
        const onEdge = [e.y === 0, e.y === SITE_SIZE - 1, e.x === 0, e.x === SITE_SIZE - 1][side];
        expect(onEdge, `${kind} ${side}`).toBe(true);
      }
      for (const h of m.houses) expect(findPath(m.grid, m.entry[0]!, h.door)).not.toBeNull();
      // El campamento: 3×3 de suelo, a 3 casillas del borde de la entrada.
      expect(m.camp).toHaveLength(9);
      for (const t of m.camp) expect(getTile(m.grid, t.x, t.y)).toBe(Tile.Floor);
    }
  const village = generateSite('village', null, 0, createRng(3));
  expect(village.grid.width).toBe(VILLAGE_SIZE);
  const houses = village.houses.filter((h) => h.kind === 'house').length;
  expect(houses).toBeGreaterThanOrEqual(4);
  expect(houses).toBeLessThanOrEqual(6);
  expect(village.houses.some((h) => ['supermarket', 'pharmacy', 'clothes'].includes(h.kind))).toBe(
    true,
  );
});

test('el mundo de un sitio: su mapa, la caja común, edificios marcados, hoguera y zombis', () => {
  const base = emptyWorld(10, 10);
  base.tick = 500;
  const before = base.common.woodLog.start;
  const w = siteMap(base, info({ id: 3, kind: 'farm', side: 1 }));
  expect(w.mapId).toBe(3);
  expect(w.common).toBe(base.common);
  expect(w.tick).toBe(500);
  expect(base.siteMaps.map((m) => m.siteId)).toEqual([3]);
  expect(siteMap(base, info({ id: 3, kind: 'farm', side: 1 }))).toBe(w); // ya existe
  expect(w.containers.length).toBeGreaterThan(0);
  expect(w.containers.every((c) => c.designated)).toBe(true);
  expect(w.blueprints.map((b) => b.kind)).toEqual(['campfire']);
  expect(w.zombies).toHaveLength(SITE_ZOMBIES.farm);
  expect(w.storage.tiles).toHaveLength(9);
  expect(base.common.woodLog.start).toBe(
    before + w.containers.reduce((n, c) => n + c.items.wood, 0),
  );
  expect(checkInvariants(base)).toEqual([]);
});

test('el mismo sitio sale igual con la misma semilla', () => {
  const a = siteMap(emptyWorld(10, 10), info({ id: 5, kind: 'gas', side: 2 }));
  const b = siteMap(emptyWorld(10, 10), info({ id: 5, kind: 'gas', side: 2 }));
  expect(a.grid.tiles).toEqual(b.grid.tiles);
  expect(a.zombies.map((z) => z.pos)).toEqual(b.zombies.map((z) => z.pos));
});

test('especiales: supervivientes atrapados en un edificio; alijo con pocos zombis; peligroso con muchos', () => {
  const base = emptyWorld(10, 10);
  const help = siteMap(base, info({ id: 11, kind: 'house', special: 'survivors' }));
  const trapped = help.stranger!.survivors;
  expect(trapped.length).toBeGreaterThanOrEqual(1);
  expect(trapped.length).toBeLessThanOrEqual(2);
  const house = help.houses[0]!.rect;
  for (const s of trapped) {
    expect(s.pos.x).toBeGreaterThanOrEqual(house.x);
    expect(s.pos.x).toBeLessThan(house.x + house.w);
  }
  const stash = siteMap(base, info({ id: 12, kind: 'farm', special: 'stash' }));
  expect(stash.houses.map((h) => h.kind)).toEqual(['house']);
  expect(stash.zombies).toHaveLength(SITE_ZOMBIES.stash);
  const danger = siteMap(base, info({ id: 13, kind: 'gas', special: 'dangerous' }));
  expect(['police', 'supermarket']).toContain(danger.houses[0]!.kind);
  expect(danger.zombies).toHaveLength(SITE_ZOMBIES.dangerous);
  expect(checkInvariants(base)).toEqual([]);
});

test('al verlos, «¿Se unen?»; si aceptas, son colonos del sitio y el sitio deja de ser especial', () => {
  const base = emptyWorld(10, 10);
  const i = info({ id: 11, kind: 'house', special: 'survivors', specialUntil: 1e9 });
  base.common.expedition.sites.push(i);
  const site = siteMap(base, i);
  const trapped = site.stranger!.survivors.map((s) => s.id);
  const ana = base.survivors[0]!;
  base.survivors = [];
  ana.pos = { ...site.stranger!.survivors[0]!.pos };
  site.survivors.push(ana);
  survivorsSystem(base);
  const d = site.decisions.find((x) => x.kind === 'stranger')!;
  expect(d.survivorIds).toEqual(trapped);
  survivorsSystem(base);
  expect(site.decisions.filter((x) => x.kind === 'stranger')).toHaveLength(1); // solo una vez
  issue(site, { type: 'decide', decisionId: d.id, option: 0 });
  ordersSystem(site);
  expect(site.survivors.map((s) => s.id)).toEqual(expect.arrayContaining(trapped));
  survivorsSystem(base);
  expect(i.special).toBeNull();
  expect(checkInvariants(base)).toEqual([]);
});

test('si nadie llega a tiempo, los supervivientes callan y desaparecen (en las cuentas)', () => {
  const base = emptyWorld(10, 10);
  const i = info({ id: 11, kind: 'house', special: 'survivors', specialUntil: 100 });
  base.common.expedition.sites.push(i);
  const site = siteMap(base, i);
  base.tick = TICKS_PER_DAY;
  for (let k = 0; k < 3 && i.special; k++) {
    sitesDailySystem(base);
    base.tick += TICKS_PER_DAY;
  }
  expect(i.special).toBeNull();
  expect(site.stranger).toBeNull();
  expect(checkInvariants(base)).toEqual([]);
});
