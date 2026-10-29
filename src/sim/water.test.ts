// H5b §6: agua — cubos y botellas en el botín, fregaderos y cisternas, el corte del agua, la lluvia
// y el barreño.
import { expect, test } from 'vitest';
import {
  BOTTLE_LITERS,
  BUCKET_LITERS,
  BUILD,
  CISTERN_LITERS,
  LOOT,
  START_HOUR,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  TUB_LITERS,
} from './balance';
import { CATALOG } from './events/catalog';
import { rainEvent } from './events/rain';
import { stormEvent } from './events/storm';
import { dropPile } from './piles';
import { gameTime } from './clock';
import { contains } from './geom';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { fillBuilding } from './loot';
import { getTile, isWalkable } from './map/grid';
import { createRng } from './rng';
import { issue } from './orders';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Container, type ContainerKind, type World } from './types';
import { findWork } from './work';
import { isRaining, mainsOn, waterSystem } from './water';
import { createWorld } from './world';
import { indoors } from './zombies/spawn';

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
  expect(w.common.log.some((e) => e.kind === 'waterCut')).toBe(false);
  w.tick++;
  waterSystem(w);
  expect(mainsOn(w)).toBe(false);
  expect(w.common.log.filter((e) => e.kind === 'waterCut')).toHaveLength(1);
  expect(START_HOUR * TICKS_PER_HOUR).toBeLessThan(TICKS_PER_DAY); // (el día 1 empieza a las 8)
});

test('invariantes: el agua, entre 0 y lo que cabe', () => {
  const w = createWorld(1);
  w.furniture.push({ id: 900, kind: 'tub', pos: { x: 1, y: 1 }, water: 25 });
  expect(checkInvariants(w).some((p) => p.includes('agua'))).toBe(true);
  w.furniture.at(-1)!.water = 20;
  expect(checkInvariants(w)).toEqual([]);
});

// H5b §6: la lluvia.
test('Llueve: suceso bueno de 3–6 h, cada 2 días como poco; la tormenta también llueve', () => {
  const w = createWorld(3);
  expect(rainEvent).toMatchObject({ id: 'rain', tone: 'good', cooldownDays: 2 });
  expect(CATALOG).toContain(rainEvent);
  expect(rainEvent.canHappen(w)).toBe(true);
  rainEvent.happen(w);
  expect(isRaining(w)).toBe(true);
  expect(w.common.rainUntil - w.tick).toBeGreaterThanOrEqual(3 * TICKS_PER_HOUR);
  expect(w.common.rainUntil - w.tick).toBeLessThanOrEqual(6 * TICKS_PER_HOUR);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'rain' });
  expect(rainEvent.canHappen(w)).toBe(false);
  const v = createWorld(3);
  stormEvent.happen(v);
  expect(v.common.rainUntil).toBe(v.common.stormUntil);
});

test('cada hora de lluvia: los cubos vacíos al aire libre se llenan; cisternas +5 (hasta 200); el barreño fuera +2 (hasta 20)', () => {
  const w = createWorld(3);
  // Una casilla al aire libre (fuera de todo edificio) y otra dentro de la base.
  const inside = w.storage.tiles[0]!;
  let outside = { x: 0, y: 0 };
  for (let r = 2; r < 30 && outside.x === 0; r++)
    for (const [dx, dy] of [
      [0, r],
      [r, 0],
      [0, -r],
      [-r, 0],
    ] as const) {
      const t = { x: w.base.door.x + dx, y: w.base.door.y + dy };
      if (isWalkable(w.grid, t.x, t.y) && !indoors(w, t.x, t.y)) {
        outside = t;
        break;
      }
    }
  dropPile(w, outside, { ...emptyInventory(), bucket: 2, food: 1 });
  dropPile(w, inside, { ...emptyInventory(), bucket: 1 });
  const cistern = w.furniture.find((f) => f.kind === 'cistern')!;
  cistern.water = 198;
  w.furniture.push({ id: w.common.nextId++, kind: 'tub', pos: outside, water: 19 });
  w.furniture.push({ id: w.common.nextId++, kind: 'tub', pos: inside, water: 0 });
  w.tick = 10 * TICKS_PER_HOUR - 1;
  w.common.rainUntil = w.tick + 3 * TICKS_PER_HOUR;
  waterSystem(w);
  expect(w.piles.find((p) => p.pos.x === outside.x && p.pos.y === outside.y)!.items).toMatchObject({
    bucket: 2,
  }); // aún no ha pasado la hora
  w.tick++;
  waterSystem(w);
  const pileOut = w.piles.find((p) => p.pos.x === outside.x && p.pos.y === outside.y)!;
  expect(pileOut.items).toMatchObject({ bucket: 0, waterBucket: 2, food: 1 });
  expect(w.piles.find((p) => p.pos.x === inside.x && p.pos.y === inside.y)!.items.bucket).toBe(1);
  expect(cistern.water).toBe(CISTERN_LITERS);
  expect(w.furniture.at(-2)!.water).toBe(TUB_LITERS);
  expect(w.furniture.at(-1)!.water).toBe(0);
  w.tick = w.common.rainUntil + TICKS_PER_HOUR - (w.common.rainUntil % TICKS_PER_HOUR);
  cistern.water = 0;
  waterSystem(w);
  expect(cistern.water).toBe(0); // ya no llueve
  expect(checkInvariants(w)).toEqual([]);
});

// H5b §6: el barreño y llenarlo (Transportar).
function yard(): World {
  const w = emptyWorld(14, 14);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor); // suelo de la base (para pasear cuando no hay nada)
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.food = 50;
  w.furniture.push({ id: 70, kind: 'tub', pos: { x: 6, y: 6 }, water: 0 });
  const s = w.survivors[0]!;
  s.pos = { x: 2.5, y: 2.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'haul';
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  w.common.outfits[0]!.allowed = ['tshirt', 'jeans'];
  return w;
}
const tub = (w: World) => w.furniture.find((f) => f.kind === 'tub')!;
const runFor = (w: World, n: number) => {
  for (let i = 0; i < n; i++) step(w);
};

test('construir un barreño: 4 tablas; queda vacío', () => {
  expect(BUILD.tub.wood).toBe(4);
  const w = yard();
  w.furniture = [];
  const s = w.survivors[0]!;
  s.work.build = true;
  s.skills.build.level = 10; // no falla
  w.storage.items.wood = 4;
  issue(w, { type: 'placeBlueprint', kind: 'tub', x: 8, y: 8 });
  runFor(w, 3 * TICKS_PER_HOUR);
  expect(w.furniture).toEqual([
    expect.objectContaining({ kind: 'tub', pos: { x: 8, y: 8 }, water: 0 }),
  ]);
});

test('con un cubo de agua en el almacén, lo vacía en el barreño y el cubo vuelve vacío', () => {
  const w = yard();
  w.storage.items.waterBucket = 1;
  runFor(w, 600);
  expect(tub(w).water).toBe(BUCKET_LITERS);
  expect(w.storage.items).toMatchObject({ waterBucket: 0, bucket: 1 });
  expect(checkInvariants(w)).toEqual([]);
});

test('las botellas de agua del almacén también se vacían en él (y se tiran)', () => {
  const w = yard();
  w.storage.items.waterBottle = 3;
  runFor(w, 600);
  expect(tub(w).water).toBe(3 * BOTTLE_LITERS);
  expect(w.storage.items.waterBottle).toBe(0);
  expect(w.survivors[0]!.carrying.waterBottle).toBe(0);
});

test('con un cubo vacío, va a llenarlo a la fuente (fregadero con agua corriente o cisterna) hasta llenar el barreño', () => {
  const w = yard();
  w.storage.items.bucket = 1;
  w.furniture.push({ id: 71, kind: 'sink', pos: { x: 11, y: 11 } });
  runFor(w, 6 * TICKS_PER_HOUR);
  expect(tub(w).water).toBe(TUB_LITERS);
  expect(w.storage.items.bucket).toBe(1);
  // Sin agua corriente, de la cisterna.
  const v = yard();
  v.storage.items.bucket = 1;
  v.waterCutAt = 0;
  v.furniture.push({ id: 71, kind: 'sink', pos: { x: 11, y: 11 } });
  v.furniture.push({ id: 72, kind: 'cistern', pos: { x: 11, y: 2 }, water: 6 });
  runFor(v, 3 * TICKS_PER_HOUR);
  expect(tub(v).water).toBe(BUCKET_LITERS);
  expect(v.furniture.find((f) => f.kind === 'cistern')!.water).toBe(2);
  expect(checkInvariants(v)).toEqual([]);
});

test('no va si no hay agua (sin agua corriente, cisterna con menos de 4 litros) ni si no caben 4 litros', () => {
  const w = yard();
  w.storage.items.bucket = 1;
  w.waterCutAt = 0;
  w.furniture.push({ id: 71, kind: 'sink', pos: { x: 11, y: 11 } });
  w.furniture.push({ id: 72, kind: 'cistern', pos: { x: 11, y: 2 }, water: 3 });
  const s = w.survivors[0]!;
  expect(findWork(s, w)).toBeNull();
  const v = yard();
  v.storage.items.waterBucket = 1;
  tub(v).water = TUB_LITERS - 3;
  expect(findWork(v.survivors[0]!, v)).toBeNull();
});
