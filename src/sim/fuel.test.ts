// V3 §4: la hoguera gasta leña y Transportar se la lleva.
import { expect, test } from 'vitest';
import { CAMPFIRE_FUEL_MAX, CAMPFIRE_FUEL_START, RECIPES, TICKS_PER_HOUR } from './balance';
import { byTheFire, furnitureSystem, isLitFire } from './furniture';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { craftBlocker } from './jobs/craft';
import { fuelJob } from './jobs/fuel';
import { step } from './step';
import { addBase, emptyWorld } from './testing/fixtures';
import type { World } from './types';

function camp(fuel: number): World {
  const w = addBase(emptyWorld(20, 12), { x: 0, y: 0, w: 8, h: 8 });
  w.seen.fill(1);
  w.storage.items = emptyInventory();
  w.furniture.push({ id: 80, kind: 'campfire', pos: { x: 12, y: 6 }, fuel });
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 3.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'haul';
  w.common.woodLog.start = 0;
  return w;
}

test('cada hora gasta una hora de leña; sin leña se apaga (y las de antes, sin el campo, nunca)', () => {
  const w = camp(2);
  w.furniture.push({ id: 81, kind: 'campfire', pos: { x: 14, y: 6 } });
  for (let h = 1; h <= 3; h++) {
    w.tick = h * TICKS_PER_HOUR;
    furnitureSystem(w);
  }
  expect(w.furniture[0]!.fuel).toBe(0);
  expect(isLitFire(w.furniture[0]!)).toBe(false);
  expect(isLitFire(w.furniture[1]!)).toBe(true);
});

test('apagada no anima ni deja cocinar', () => {
  const w = camp(0);
  const s = w.survivors[0]!;
  s.pos = { x: 12.5, y: 7.5 };
  w.tick = 14 * TICKS_PER_HOUR; // 22:00 (junto al fuego solo cuenta a oscuras)
  expect(byTheFire(w, s)).toBe(false);
  expect(craftBlocker(w, RECIPES.cook)).toEqual({ kind: 'fire' });
  w.storage.items.potato = 2;
  w.furniture[0]!.fuel = 3;
  expect(byTheFire(w, s)).toBe(true);
  expect(craftBlocker(w, RECIPES.cook)).toBeNull();
});

test('recién construida trae 12 horas', async () => {
  const { workOnBlueprint } = await import('./jobs/build');
  const w = camp(1);
  w.furniture = [];
  const s = w.survivors[0]!;
  s.pos = { x: 15.5, y: 6.5 };
  s.skills.build.level = 10;
  s.work.build = true;
  w.blueprints.push({ id: 90, kind: 'campfire', pos: { x: 16, y: 6 }, wood: 3, progress: 1e9 });
  workOnBlueprint(w, s, 90);
  expect(w.furniture.find((f) => f.kind === 'campfire')?.fuel).toBe(CAMPFIRE_FUEL_START);
});

test('con menos de 8 horas, Transportar le lleva tablas del almacén hasta llenarla', () => {
  const w = camp(3);
  w.storage.items.wood = 10;
  w.common.woodLog.start = 10;
  expect(fuelJob(w.survivors[0]!, w)).not.toBeNull();
  for (let i = 0; i < 2000 && w.furniture[0]!.fuel! < 20; i++) step(w);
  expect(w.furniture[0]!.fuel).toBeGreaterThanOrEqual(CAMPFIRE_FUEL_MAX - 1);
  expect(w.storage.items.wood + w.survivors[0]!.carrying.wood).toBe(10 - 6);
  expect(checkInvariants(w)).toEqual([]);
});

test('con 8 horas o más, o sin tablas, no le lleva', () => {
  const w = camp(8);
  w.storage.items.wood = 10;
  expect(fuelJob(w.survivors[0]!, w)).toBeNull();
  w.furniture[0]!.fuel = 2;
  w.storage.items.wood = 0;
  expect(fuelJob(w.survivors[0]!, w)).toBeNull();
});
