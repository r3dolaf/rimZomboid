// H5b §6: agua — cubos y botellas en el botín, fregaderos y cisternas, el corte del agua, la lluvia
// y el barreño.
import { expect, test } from 'vitest';
import { CISTERN_LITERS, LOOT, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import { gameTime } from './clock';
import { contains } from './geom';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { fillBuilding } from './loot';
import { getTile } from './map/grid';
import { createRng } from './rng';
import { Tile, type Container, type ContainerKind } from './types';
import { mainsOn, waterSystem } from './water';
import { createWorld } from './world';

function furniture(kinds: readonly ContainerKind[]): Container[] {
  return kinds.map((kind, i) => ({
    id: i + 1,
    houseId: 1,
    pos: { x: i, y: 0 },
    kind,
    items: emptyInventory(),
    searched: false,
    designated: false,
    reservedBy: null,
  }));
}

test('botellas de agua en el supermercado, la gasolinera y las casas; cubos vacíos en la ferretería, la granja y la nave', () => {
  expect(LOOT.supermarket.waterBottle).toBeDefined();
  expect(LOOT.gas.waterBottle).toBeDefined();
  expect(LOOT.house.waterBottle).toBeDefined();
  for (const k of ['hardware', 'farm', 'warehouse'] as const) expect(LOOT[k].bucket).toBeDefined();
  let bottles = 0;
  let buckets = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const shop = furniture(['fridge', 'shelf', 'counter']);
    fillBuilding('supermarket', shop, createRng(seed));
    bottles += shop.reduce((n, c) => n + c.items.waterBottle, 0);
    const crates = furniture(['crate', 'crate', 'shelf']);
    fillBuilding('hardware', crates, createRng(seed));
    buckets += crates.reduce((n, c) => n + c.items.bucket, 0);
    for (const c of crates) if (c.items.bucket > 0) expect(['crate', 'shelf']).toContain(c.kind);
  }
  expect(bottles).toBeGreaterThan(0);
  expect(buckets).toBeGreaterThan(0);
});

test('fregaderos en casas, supermercado, gasolinera y granja; cisternas llenas en granja, gasolinera y nave', () => {
  for (const seed of [1, 2, 3, 4]) {
    const w = createWorld(seed);
    expect(checkInvariants(w)).toEqual([]);
    for (const h of w.houses) {
      const inside = w.furniture.filter((f) => contains(h.rect, f.pos));
      const sinks = inside.filter((f) => f.kind === 'sink');
      const cisterns = inside.filter((f) => f.kind === 'cistern');
      const wantsSink = ['house', 'supermarket', 'gas', 'farm'].includes(h.kind);
      const wantsCistern = ['farm', 'gas', 'warehouse'].includes(h.kind);
      expect(sinks.length).toBeLessThanOrEqual(wantsSink ? 1 : 0);
      expect(cisterns.length).toBeLessThanOrEqual(wantsCistern ? 1 : 0);
      for (const f of inside) {
        expect(getTile(w.grid, f.pos.x, f.pos.y)).toBe(Tile.Floor);
        expect(w.containers.some((c) => c.pos.x === f.pos.x && c.pos.y === f.pos.y)).toBe(false);
      }
      for (const c of cisterns) expect(c.water).toBe(CISTERN_LITERS);
    }
    const kinds = (k: string) => w.houses.filter((h) => h.kind === k);
    const withSink = kinds('house').filter((h) =>
      w.furniture.some((f) => f.kind === 'sink' && contains(h.rect, f.pos)),
    );
    expect(withSink.length).toBeGreaterThan(kinds('house').length / 2);
    expect(w.furniture.some((f) => f.kind === 'cistern')).toBe(true);
  }
  expect(CISTERN_LITERS).toBe(200);
});

test('el agua corriente se corta un día entre el 7 y el 14, con aviso', () => {
  const days = new Set<number>();
  for (let seed = 1; seed <= 40; seed++) {
    const w = createWorld(seed);
    const day = gameTime(w.waterCutAt).day;
    expect(day).toBeGreaterThanOrEqual(7);
    expect(day).toBeLessThanOrEqual(14);
    days.add(day);
  }
  expect(days.size).toBeGreaterThan(4);
  const w = createWorld(5);
  w.tick = w.waterCutAt - 1;
  expect(mainsOn(w)).toBe(true);
  waterSystem(w);
  expect(w.log.some((e) => e.kind === 'waterCut')).toBe(false);
  w.tick++;
  waterSystem(w);
  expect(mainsOn(w)).toBe(false);
  expect(w.log.filter((e) => e.kind === 'waterCut')).toHaveLength(1);
  expect(START_HOUR * TICKS_PER_HOUR).toBeLessThan(TICKS_PER_DAY); // (el día 1 empieza a las 8)
});

test('invariantes: el agua, entre 0 y lo que cabe', () => {
  const w = createWorld(1);
  w.furniture.push({ id: 900, kind: 'tub', pos: { x: 1, y: 1 }, water: 25 });
  expect(checkInvariants(w).some((p) => p.includes('agua'))).toBe(true);
  w.furniture.at(-1)!.water = 20;
  expect(checkInvariants(w)).toEqual([]);
});
