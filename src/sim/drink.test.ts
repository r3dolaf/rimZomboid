// V2: la sed y beber.
import { expect, test } from 'vitest';
import {
  DEHYDRATED_BLOOD,
  DEHYDRATED_MOOD,
  DRINK_RESTORE,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  THIRSTY_MOOD,
} from './balance';
import { bloodTick } from './blood';
import { brains } from './brain';
import { drinkSomething, finishDrink } from './drink';
import { contains } from './geom';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { moodModifiers } from './mood';
import { step } from './step';
import { needsSystem } from './systems/needs';
import { addBase, emptyWorld, withoutZombies } from './testing/fixtures';
import type { World } from './types';
import { createWorld } from './world';

/** Hierba de 20×12 con la base (8×8) a la izquierda, todo visto; Ana dentro, sin hacer nada. */
function home(): World {
  const w = addBase(emptyWorld(20, 12), { x: 0, y: 0, w: 8, h: 8 });
  w.seen.fill(1);
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 3.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
  w.storage.items = emptyInventory();
  w.waterCutAt = 1e9;
  return w;
}

test('la sed baja 100 al día; con fiebre, una vez y media más', () => {
  const w = emptyWorld(3, 3);
  const s = w.survivors[0]!;
  for (let i = 0; i < TICKS_PER_DAY / 4; i++) needsSystem(w);
  expect(s.needs.thirst).toBeCloseTo(75, 5);
  s.fever = {
    cause: 'flu',
    since: 0,
    stage: 'fever',
    rest: false,
    restTicks: 0,
    badLuck: false,
    checks: 0,
  };
  for (let i = 0; i < TICKS_PER_DAY / 4; i++) needsSystem(w);
  expect(s.needs.thirst).toBeCloseTo(75 - 25 * 1.5, 5);
});

test('con sed baja el ánimo; deshidratado, más, y pierde sangre hasta morir de sed', () => {
  const w = emptyWorld(3, 3);
  const s = w.survivors[0]!;
  s.needs.thirst = 20;
  expect(moodModifiers(s, 0)).toContainEqual({ id: 'thirsty', value: THIRSTY_MOOD });
  s.needs.thirst = 0;
  expect(moodModifiers(s, 0)).toContainEqual({ id: 'dehydrated', value: DEHYDRATED_MOOD });
  s.blood = 50;
  for (let i = 0; i < TICKS_PER_HOUR; i++) bloodTick(w, s);
  expect(s.blood).toBeCloseTo(50 - DEHYDRATED_BLOOD, 5);
  s.blood = 0.001;
  bloodTick(w, s);
  expect(s.dying).toBe('thirst');
});

test('se bebe del fregadero con agua corriente antes que del barreño de al lado', () => {
  const w = home();
  const s = w.survivors[0]!;
  w.furniture.push({ id: 80, kind: 'tub', pos: { x: 4, y: 3 }, water: 10 });
  w.furniture.push({ id: 81, kind: 'sink', pos: { x: 1, y: 5 } });
  const a = drinkSomething(s, w);
  expect(a?.type === 'moveTo' && a.then).toEqual({ type: 'drink', sourceId: 81 });
  w.waterCutAt = 0; // sin agua corriente, del barreño
  const b = drinkSomething(s, w);
  expect(b?.type === 'moveTo' && b.then).toEqual({ type: 'drink', sourceId: 80 });
});

test('sin fregadero ni depósitos, una botella del almacén; luego, la suya', () => {
  const w = home();
  const s = w.survivors[0]!;
  expect(drinkSomething(s, w)).toBeNull();
  s.carrying.waterBottle = 1;
  expect(drinkSomething(s, w)).toMatchObject({ type: 'drink', fromPack: true });
  w.storage.items.waterBottle = 2;
  const a = drinkSomething(s, w);
  expect(a?.type === 'moveTo' && a.then).toEqual({ type: 'drink', sourceId: null });
});

test('beber: un litro del depósito, una botella del almacén o la suya; sube 50', () => {
  const w = home();
  const s = w.survivors[0]!;
  const tub = { id: 80, kind: 'tub' as const, pos: { x: 4, y: 3 }, water: 3 };
  w.furniture.push(tub);
  s.needs.thirst = 30;
  expect(finishDrink(w, s, { sourceId: 80 })).toBe(true);
  expect(tub.water).toBe(2);
  expect(s.needs.thirst).toBe(30 + DRINK_RESTORE);
  w.storage.items.waterBottle = 1;
  s.needs.thirst = 10;
  expect(finishDrink(w, s, { sourceId: null })).toBe(true);
  expect(w.storage.items.waterBottle).toBe(0);
  expect(finishDrink(w, s, { sourceId: null })).toBe(false);
  s.carrying.waterBottle = 1;
  expect(finishDrink(w, s, { sourceId: null, fromPack: true })).toBe(true);
  expect(s.carrying.waterBottle).toBe(0);
  expect(s.needs.thirst).toBe(100);
});

test('si se seca el agua adonde va, lo deja', () => {
  const w = home();
  const s = w.survivors[0]!;
  const tub = { id: 80, kind: 'tub' as const, pos: { x: 6, y: 6 }, water: 1 };
  w.furniture.push(tub);
  s.needs.thirst = 20;
  s.action = brains.ai.decide(s, w)!;
  expect(s.action.type === 'moveTo' && s.action.then?.type).toBe('drink');
  tub.water = 0;
  expect(brains.ai.decide(s, w)).toEqual({ type: 'idle', ticksLeft: 0 });
});

test('con sed, va a beber antes que a comer', () => {
  const w = home();
  const s = w.survivors[0]!;
  w.storage.items.food = 5;
  w.furniture.push({ id: 81, kind: 'sink', pos: { x: 1, y: 5 } });
  s.needs.hunger = 20;
  s.needs.thirst = 20;
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type).toBe('drink');
});

test('la base tiene su fregadero (dentro, junto a una pared) y cada uno empieza con la sed de su hambre', () => {
  for (const seed of [1, 2, 3, 10]) {
    const w = createWorld(seed);
    const sinks = w.furniture.filter((f) => f.kind === 'sink' && contains(w.base.rect, f.pos));
    expect(sinks, `semilla ${seed}`).toHaveLength(1);
    expect(w.beds.some((b) => b.pos.x === sinks[0]!.pos.x && b.pos.y === sinks[0]!.pos.y)).toBe(
      false,
    );
    for (const s of w.survivors) expect(s.needs.thirst).toBe(s.needs.hunger);
    expect(checkInvariants(w)).toEqual([]);
  }
});

test('en un día en la base nadie pasa sed: beben del fregadero', () => {
  const w = withoutZombies(createWorld(3));
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    step(w);
    for (const s of w.survivors) expect(s.needs.thirst, s.name).toBeGreaterThan(0);
  }
  expect(checkInvariants(w)).toEqual([]);
});

test('fuera de la base y con una botella, bebe de la suya antes que ir lejos a por agua', () => {
  const w = addBase(emptyWorld(40, 12), { x: 0, y: 0, w: 8, h: 8 });
  w.seen.fill(1);
  w.waterCutAt = 1e9;
  const s = w.survivors[0]!;
  s.pos = { x: 36.5, y: 10.5 };
  s.carrying.waterBottle = 1;
  w.furniture.push({ id: 81, kind: 'sink', pos: { x: 1, y: 5 } }); // a unas 35 casillas
  expect(drinkSomething(s, w)).toMatchObject({ type: 'drink', fromPack: true });
  s.pos = { x: 15.5, y: 6.5 }; // a 15: va al fregadero
  expect(drinkSomething(s, w)?.type).toBe('moveTo');
});

test('las invariantes vigilan la sed', () => {
  const w = home();
  w.survivors[0]!.needs.thirst = -1;
  expect(checkInvariants(w).join(' | ')).toContain('thirst fuera de 0–100');
});

test('sin agua corriente y con menos de 2 litros por persona en la base, «Queda poca agua» (una vez)', async () => {
  const { lowWaterSystem, baseWater } = await import('./drink');
  const w = home();
  w.waterCutAt = 0;
  w.furniture.push({ id: 80, kind: 'barrel', pos: { x: 12, y: 6 }, water: 1 });
  expect(baseWater(w)).toEqual({ liters: 1, bottles: 0, mains: false });
  w.tick = TICKS_PER_HOUR;
  lowWaterSystem(w);
  expect(w.common.log.filter((e) => e.kind === 'lowWater')).toHaveLength(1);
  w.tick = 2 * TICKS_PER_HOUR;
  lowWaterSystem(w);
  expect(w.common.log.filter((e) => e.kind === 'lowWater')).toHaveLength(1); // no se repite
  w.furniture[0]!.water = 30; // vuelve a haber
  w.tick = 3 * TICKS_PER_HOUR;
  lowWaterSystem(w);
  expect(w.waterLow).toBe(false);
  w.furniture[0]!.water = 0;
  w.tick = 4 * TICKS_PER_HOUR;
  lowWaterSystem(w);
  expect(w.common.log.filter((e) => e.kind === 'lowWater')).toHaveLength(2);
  // Con agua corriente, nunca.
  const v = home();
  v.tick = TICKS_PER_HOUR;
  lowWaterSystem(v);
  expect(v.common.log).toHaveLength(0);
});
