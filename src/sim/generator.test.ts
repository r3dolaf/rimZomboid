// E1: el generador: construirlo, la gasolina (Transportar), encenderlo y apagarlo y, en marcha, el
// agua del fregadero, la nevera, la luz de noche, la radio sin pilas y el ruido.
import { expect, test } from 'vitest';
import {
  GEN_FRIDGE,
  GEN_FUEL_MAX,
  GEN_FUEL_PER_CAN,
  GEN_NOISE,
  GEN_NOISE_TICKS,
  GEN_REFUEL_BELOW,
  POWER_LOOT,
  TICKS_PER_HOUR,
  VISION_DAY,
} from './balance';
import { canPlace } from './build';
import { darkness } from './clock';
import { drinkable } from './drink';
import { visionFor } from './furniture';
import { generatorSystem } from './generator';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { workOnBlueprint } from './jobs/build';
import { fuelJob } from './jobs/fuel';
import { issue } from './orders';
import { fridgeMult, generatorOf, powered } from './power';
import { radioSystem } from './radio';
import { createRng } from './rng';
import { spoilSystem, spoilsNow } from './spoil';
import { step } from './step';
import { addBase, emptyWorld } from './testing/fixtures';
import type { World } from './types';
import { tapOn } from './water';
import { createWorld } from './world';
import { newZombie } from './zombies/spawn';

function base(): World {
  const w = addBase(emptyWorld(40, 12), { x: 0, y: 0, w: 8, h: 8 });
  w.seen.fill(1);
  w.storage.items = emptyInventory();
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 3.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'haul';
  w.common.woodLog.start = 0;
  return w;
}

const inside = { x: 2, y: 2 };
const gen = (w: World, fuel: number, on = true) =>
  w.furniture.push({ id: 70, kind: 'generator', pos: { ...inside }, fuel, on });

test('el plano: en el suelo de la base, con un generador en el almacén y solo uno; se construye encendido', () => {
  const w = base();
  expect(canPlace(w, 'generator', inside)).toBe(false);
  w.storage.items.generator = 1;
  expect(canPlace(w, 'generator', inside)).toBe(true);
  expect(canPlace(w, 'generator', { x: 20, y: 6 })).toBe(false); // fuera de la base
  const s = w.survivors[0]!;
  s.work.build = true;
  s.skills.build.level = 10;
  s.pos = { x: 2.5, y: 3.5 };
  w.blueprints.push({ id: 90, kind: 'generator', pos: { ...inside }, wood: 2, progress: 1e9 });
  w.common.woodLog.start = 2;
  workOnBlueprint(w, s, 90);
  expect(generatorOf(w)).toMatchObject({ kind: 'generator', pos: inside, fuel: 0, on: true });
  expect(w.storage.items.generator).toBe(0);
  w.storage.items.generator = 1;
  expect(canPlace(w, 'generator', { x: 3, y: 2 })).toBe(false); // ya hay uno
  expect(checkInvariants(w)).toEqual([]);
});

test('en marcha (encendido y con gasolina) gasta una hora por hora; apagado o sin gasolina, nada', () => {
  const w = base();
  gen(w, 3);
  expect(powered(w)).toBe(true);
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) {
    generatorSystem(w);
    w.tick++;
  }
  expect(generatorOf(w)!.fuel).toBe(1);
  issue(w, { type: 'setGenerator', on: false });
  step(w);
  expect(powered(w)).toBe(false);
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) {
    generatorSystem(w);
    w.tick++;
  }
  expect(generatorOf(w)!.fuel).toBe(1);
  issue(w, { type: 'setGenerator', on: true });
  step(w);
  generatorOf(w)!.fuel = 0;
  expect(powered(w)).toBe(false);
});

test('con menos de 8 horas, Transportar le lleva bidones hasta 24 (cada uno, 6 horas)', () => {
  const w = base();
  gen(w, 1, false);
  expect(fuelJob(w.survivors[0]!, w)).toBeNull(); // sin bidones
  w.storage.items.gasCan = 10;
  expect(fuelJob(w.survivors[0]!, w)).not.toBeNull();
  for (let i = 0; i < 3000 && generatorOf(w)!.fuel! < GEN_FUEL_MAX - GEN_FUEL_PER_CAN; i++) step(w);
  expect(generatorOf(w)!.fuel).toBeGreaterThan(GEN_FUEL_MAX - GEN_FUEL_PER_CAN);
  expect(generatorOf(w)!.fuel).toBeLessThanOrEqual(GEN_FUEL_MAX);
  expect(w.storage.items.gasCan + w.survivors[0]!.carrying.gasCan).toBe(10 - 4);
  expect(checkInvariants(w)).toEqual([]);
  generatorOf(w)!.fuel = GEN_REFUEL_BELOW;
  expect(fuelJob(w.survivors[0]!, w)).toBeNull();
});

test('en marcha, el fregadero da agua aunque se haya cortado', () => {
  const w = base();
  w.furniture.push({ id: 71, kind: 'sink', pos: { x: 5, y: 5 } });
  const sink = w.furniture.at(-1)!;
  w.waterCutAt = 0;
  w.tick = 10;
  expect(tapOn(w)).toBe(false);
  expect(drinkable(w, sink)).toBe(false);
  gen(w, 5);
  expect(tapOn(w)).toBe(true);
  expect(drinkable(w, sink)).toBe(true);
  generatorOf(w)!.on = false;
  expect(drinkable(w, sink)).toBe(false);
});

test('la nevera: lo fresco se estropea menos según las horas en marcha desde la mañana anterior', () => {
  const w = base();
  expect(fridgeMult(w)).toBe(1);
  gen(w, 24);
  expect(fridgeMult(w)).toBe(1);
  for (let i = 0; i < 12 * TICKS_PER_HOUR; i++) {
    generatorSystem(w);
    w.tick++;
  }
  expect(generatorOf(w)!.powered).toBe(12);
  expect(fridgeMult(w)).toBeCloseTo(1 - (1 - GEN_FRIDGE) / 2);
  generatorOf(w)!.powered = 24;
  expect(fridgeMult(w)).toBeCloseTo(GEN_FRIDGE);
});

test('la nevera, de verdad: con 24 horas en marcha se estropean menos hortalizas (y vuelve a contar)', () => {
  const lost = (withGen: boolean) => {
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = base();
      w.rng = createRng(seed);
      w.storage.items.veg = 100;
      if (withGen) {
        gen(w, 24);
        generatorOf(w)!.powered = 24;
      }
      for (w.tick = 0; !spoilsNow(w.tick); w.tick++);
      spoilSystem(w);
      total += 100 - w.storage.items.veg;
      if (withGen) expect(generatorOf(w)!.powered).toBe(0);
    }
    return total;
  };
  expect(lost(true)).toBeLessThan(lost(false) / 2);
});

test('de noche, en la base y con el generador en marcha, se ve como de día', () => {
  const w = base();
  const s = w.survivors[0]!;
  for (w.tick = 0; darkness(w.tick) < 1; w.tick += TICKS_PER_HOUR);
  expect(visionFor(w, s)).toBeLessThan(VISION_DAY);
  gen(w, 5);
  expect(visionFor(w, s)).toBe(VISION_DAY);
  s.pos = { x: 30.5, y: 5.5 }; // fuera de la base
  expect(visionFor(w, s)).toBeLessThan(VISION_DAY);
});

test('con el generador en marcha la radio se escucha sin gastar pilas (y sin pilas)', () => {
  const w = base();
  w.furniture.push({ id: 81, kind: 'radio', pos: { x: 4, y: 2 }, fuel: 0, on: true });
  w.tick = TICKS_PER_HOUR;
  radioSystem(w);
  expect(w.common.rescue?.heard ?? 0).toBe(0);
  gen(w, 5);
  radioSystem(w);
  expect(w.common.rescue!.heard).toBe(1);
  w.furniture.find((f) => f.kind === 'radio')!.fuel = 3;
  w.tick += TICKS_PER_HOUR;
  radioSystem(w);
  expect(w.furniture.find((f) => f.kind === 'radio')!.fuel).toBe(3);
});

test('en marcha hace ruido: los zombis a 15 casillas lo oyen; apagado, no', () => {
  const w = base();
  const near = newZombie(w, { x: 2 + GEN_NOISE - 2, y: 2 });
  const far = newZombie(w, { x: 2 + GEN_NOISE + 6, y: 2 });
  near.state = 'wander';
  far.state = 'wander';
  w.zombies.push(near, far);
  gen(w, 5, false);
  w.tick = GEN_NOISE_TICKS * 3;
  generatorSystem(w);
  expect(near.state).toBe('wander');
  generatorOf(w)!.on = true;
  generatorSystem(w);
  expect(near.state).toBe('alert');
  expect(far.state).toBe('wander');
});

test('el botín: generadores en ferreterías, naves y granjas; bidones en gasolineras (con su azar)', () => {
  let gens = 0;
  let cans = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const w = createWorld(seed);
    for (const h of w.houses) {
      const cs = w.containers.filter((c) => c.houseId === h.id);
      const sum = (k: 'generator' | 'gasCan') => cs.reduce((n, c) => n + c.items[k], 0);
      if (!POWER_LOOT[h.kind as keyof typeof POWER_LOOT]) {
        expect(sum('generator') + sum('gasCan')).toBe(0);
        continue;
      }
      expect(sum('generator')).toBeLessThanOrEqual(1);
      if (h.kind !== 'hardware' && h.kind !== 'warehouse' && h.kind !== 'farm')
        expect(sum('generator')).toBe(0);
      gens += sum('generator');
      cans += sum('gasCan');
    }
  }
  expect(gens).toBeGreaterThan(0);
  expect(cans).toBeGreaterThan(0);
});
