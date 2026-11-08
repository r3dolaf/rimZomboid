// V2 §3: el barril de lluvia.
import { expect, test } from 'vitest';
import { BARREL_LITERS, BOTTLES_KEEP, BUILD, RAIN_BARREL_LITERS, TICKS_PER_HOUR } from './balance';
import { canPlace } from './build';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { waterJob } from './jobs/water';
import { step } from './step';
import { addBase, emptyWorld } from './testing/fixtures';
import type { World } from './types';
import { waterSystem } from './water';

function yard(): World {
  const w = addBase(emptyWorld(20, 12), { x: 0, y: 0, w: 8, h: 8 });
  w.seen.fill(1);
  w.storage.items = emptyInventory();
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 3.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'haul';
  s.needs.thirst = 100;
  return w;
}

test('cuesta 6 tablas y una hora; va en suelo libre', () => {
  expect(BUILD.barrel).toEqual({ wood: 6, ticks: TICKS_PER_HOUR });
  const w = yard();
  expect(canPlace(w, 'barrel', { x: 12, y: 6 })).toBe(true);
  w.furniture.push({ id: 90, kind: 'barrel', pos: { x: 12, y: 6 }, water: 0 });
  expect(canPlace(w, 'barrel', { x: 12, y: 6 })).toBe(false);
});

test('al aire libre, cada hora de lluvia suma 4 litros, hasta 60', () => {
  const w = yard();
  const out = { id: 90, kind: 'barrel' as const, pos: { x: 12, y: 6 }, water: BARREL_LITERS - 2 };
  const inside = { id: 91, kind: 'barrel' as const, pos: { x: 3, y: 3 }, water: 0 };
  w.furniture.push({ ...out, water: 0 }, inside);
  w.common.rainUntil = 10 * TICKS_PER_HOUR;
  w.tick = TICKS_PER_HOUR;
  waterSystem(w);
  expect(w.furniture[0]!.water).toBe(RAIN_BARREL_LITERS);
  expect(inside.water).toBe(0);
  w.furniture[0]!.water = BARREL_LITERS - 2;
  w.tick = 2 * TICKS_PER_HOUR;
  waterSystem(w);
  expect(w.furniture[0]!.water).toBe(BARREL_LITERS);
  expect(checkInvariants(w)).toEqual([]);
});

test('Transportar lo llena a cubos desde un fregadero con agua corriente', () => {
  const w = yard();
  w.waterCutAt = 1e9;
  w.storage.items.bucket = 1;
  w.furniture.push({ id: 80, kind: 'sink', pos: { x: 1, y: 5 } });
  w.furniture.push({ id: 90, kind: 'barrel', pos: { x: 12, y: 6 }, water: 0 });
  for (let i = 0; i < 3000 && (w.furniture[1]!.water ?? 0) < 12; i++) step(w);
  expect(w.furniture[1]!.water).toBeGreaterThanOrEqual(12);
  expect(checkInvariants(w)).toEqual([]);
});

test('las botellas del almacén se vacían en los depósitos salvo las 4 últimas', () => {
  const w = yard();
  w.furniture.push({ id: 90, kind: 'barrel', pos: { x: 12, y: 6 }, water: 0 });
  w.storage.items.waterBottle = BOTTLES_KEEP;
  expect(waterJob(w.survivors[0]!, w)).toBeNull();
  w.storage.items.waterBottle = BOTTLES_KEEP + 3;
  for (let i = 0; i < 2000 && (w.furniture[0]!.water ?? 0) < 3; i++) step(w);
  expect(w.storage.items.waterBottle).toBe(BOTTLES_KEEP);
  expect(w.furniture[0]!.water).toBe(3);
});
