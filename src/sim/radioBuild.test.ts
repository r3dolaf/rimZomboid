// C1 §1: Construir → Radio (en el suelo de la base, con una radio en el almacén, una sola, que se
// gasta al terminar); su carga con pilas (Transportar, como la leña de la hoguera); encenderla y
// apagarla.
import { expect, test } from 'vitest';
import { BUILD, CHARGE_PER_BATTERY, RADIO_CHARGE_MAX } from './balance';
import { canPlace } from './build';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { workOnBlueprint } from './jobs/build';
import { fuelJob } from './jobs/fuel';
import { issue } from './orders';
import { radioOf } from './radio';
import { step } from './step';
import { addBase, emptyWorld } from './testing/fixtures';
import type { World } from './types';

function base(): World {
  const w = addBase(emptyWorld(20, 12), { x: 0, y: 0, w: 8, h: 8 });
  w.seen.fill(1);
  w.storage.items = emptyInventory();
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 3.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'haul';
  w.common.woodLog.start = 0;
  return w;
}

const inside = { x: 2, y: 2 };

test('el plano: en el suelo de la base, con una radio en el almacén y solo uno', () => {
  const w = base();
  expect(BUILD.radio).toEqual({ wood: 2, ticks: BUILD.tub.ticks });
  expect(canPlace(w, 'radio', inside)).toBe(false); // sin radio en el almacén
  w.storage.items.radio = 1;
  expect(canPlace(w, 'radio', inside)).toBe(true);
  expect(canPlace(w, 'radio', { x: 12, y: 6 })).toBe(false); // fuera de la base
  issue(w, { type: 'placeBlueprint', kind: 'radio', x: inside.x, y: inside.y });
  step(w);
  expect(w.blueprints.filter((b) => b.kind === 'radio')).toHaveLength(1);
  w.storage.items.radio = 2;
  expect(canPlace(w, 'radio', { x: 3, y: 2 })).toBe(false); // ya hay un plano
});

test('al terminarla se gasta la radio del almacén y queda encendida, sin carga; sin radio, espera', () => {
  const w = base();
  const s = w.survivors[0]!;
  s.work.build = true;
  s.skills.build.level = 10;
  s.pos = { x: 2.5, y: 3.5 };
  w.blueprints.push({ id: 90, kind: 'radio', pos: { ...inside }, wood: 2, progress: 1e9 });
  w.common.woodLog.start = 2;
  expect(workOnBlueprint(w, s, 90)).toBe(true); // sin radio no tiene sentido seguir
  expect(radioOf(w)).toBeNull();
  w.storage.items.radio = 1;
  workOnBlueprint(w, s, 90);
  const r = radioOf(w);
  expect(r).toMatchObject({ kind: 'radio', pos: inside, fuel: 0, on: true });
  expect(w.storage.items.radio).toBe(0);
  w.storage.items.radio = 1;
  expect(canPlace(w, 'radio', { x: 3, y: 2 })).toBe(false); // ya hay una
  expect(checkInvariants(w)).toEqual([]);
});

test('con menos de 6 horas de carga, Transportar le lleva pilas hasta 24 (cada una, 6 horas)', () => {
  const w = base();
  w.furniture.push({ id: 80, kind: 'radio', pos: { ...inside }, fuel: 1, on: true });
  expect(fuelJob(w.survivors[0]!, w)).toBeNull(); // sin pilas
  w.storage.items.battery = 10;
  expect(fuelJob(w.survivors[0]!, w)).not.toBeNull();
  for (let i = 0; i < 2000 && radioOf(w)!.fuel! < RADIO_CHARGE_MAX - CHARGE_PER_BATTERY; i++)
    step(w);
  expect(radioOf(w)!.fuel).toBeGreaterThan(RADIO_CHARGE_MAX - CHARGE_PER_BATTERY);
  expect(radioOf(w)!.fuel).toBeLessThanOrEqual(RADIO_CHARGE_MAX);
  expect(w.storage.items.battery + w.survivors[0]!.carrying.battery).toBe(10 - 4);
  expect(w.common.woodLog.spent).toBe(0); // las pilas no son leña
  expect(checkInvariants(w)).toEqual([]);
  radioOf(w)!.fuel = 6;
  expect(fuelJob(w.survivors[0]!, w)).toBeNull(); // con 6 o más, no
});

test('encender y apagar (también en pausa, con la orden)', () => {
  const w = base();
  w.furniture.push({ id: 80, kind: 'radio', pos: { ...inside }, fuel: 3, on: true });
  issue(w, { type: 'setRadio', on: false });
  step(w);
  expect(radioOf(w)!.on).toBe(false);
  issue(w, { type: 'setRadio', on: true });
  step(w);
  expect(radioOf(w)!.on).toBe(true);
});
