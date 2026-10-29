// H5c1 §2: el mapa de un sitio, con las recetas del pueblo (H4f): edificios, botín, zombis y
// el campamento junto a la entrada.
import { expect, test } from 'vitest';
import { SITE_SIZE, SITE_ZOMBIES, VILLAGE_SIZE } from './balance';
import { checkInvariants } from './invariants';
import { generateSite } from './map/site';
import { getTile } from './map/grid';
import { findPath } from './path/astar';
import { createRng } from './rng';
import { siteMap } from './sites';
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
