import { expect, test } from 'vitest';
import { GROW_HOURS, WATER_CAN_LITERS, WATER_MOISTURE_HOURS } from './balance';
import { cropStage, markPlot } from './farm';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { farmJob, harvestVeg } from './jobs/farm';
import { step } from './step';
import { addBase, emptyWorld } from './testing/fixtures';
import type { World } from './types';

/** Hierba de 16×12 con la base a la izquierda, todo visto; Ana solo cultiva. */
function farm(): World {
  const w = addBase(emptyWorld(16, 12), { x: 0, y: 0, w: 5, h: 5 });
  w.seen.fill(1);
  const s = w.survivors[0]!;
  s.pos = { x: 2.5, y: 2.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'farm';
  w.storage.items = emptyInventory();
  return w;
}

function run(w: World, ticks: number, until: () => boolean = () => false): void {
  for (let i = 0; i < ticks && !until(); i++) step(w);
}

test('con semillas en el almacén, va a por ellas y siembra el huerto', () => {
  const w = farm();
  w.storage.items.seeds = 3;
  markPlot(w, 8, 6, true);
  markPlot(w, 9, 6, true);
  run(w, 2000, () => w.plots.every((p) => p.crop !== null));
  expect(w.plots.every((p) => cropStage(p) === 'growing')).toBe(true);
  expect(w.storage.items.seeds + w.survivors[0]!.carrying.seeds).toBe(1);
  expect(w.survivors[0]!.skills.farm.xp).toBeGreaterThan(0);
  expect(checkInvariants(w)).toEqual([]);
});

test('vuelve con las semillas que le sobran al almacén', () => {
  const w = farm();
  w.survivors[0]!.carrying.seeds = 3; // coge solo las que va a sembrar; aquí lleva de más
  markPlot(w, 8, 6, true);
  run(w, 3000, () => w.storage.items.seeds === 2);
  expect(w.plots[0]!.crop).not.toBeNull();
  expect(w.storage.items.seeds).toBe(2);
  expect(w.survivors[0]!.carrying.seeds).toBe(0);
});

test('riega lo seco con agua del barreño (4 litros por viaje, 1 por parcela)', () => {
  const w = farm();
  w.furniture.push({ id: 90, kind: 'tub', pos: { x: 6, y: 2 }, water: 10 });
  markPlot(w, 8, 6, true);
  markPlot(w, 9, 6, true);
  for (const p of w.plots) p.crop = { grown: 5, ripe: 0, dry: 0 };
  run(w, 2000, () => w.plots.every((p) => p.moisture > 0));
  expect(w.plots.map((p) => p.moisture)).toEqual([WATER_MOISTURE_HOURS, WATER_MOISTURE_HOURS]);
  expect(w.furniture[0]!.water).toBe(10 - WATER_CAN_LITERS);
  expect(w.survivors[0]!.waterCan).toBe(WATER_CAN_LITERS - 2);
});

test('sin agua en ninguna fuente no puede regar (ni lo intenta)', () => {
  const w = farm();
  w.furniture.push({ id: 90, kind: 'tub', pos: { x: 6, y: 2 }, water: 0 });
  markPlot(w, 8, 6, true);
  w.plots[0]!.crop = { grown: 5, ripe: 0, dry: 0 };
  expect(farmJob(w.survivors[0]!, w)).toBeNull();
});

test('cosecha lo maduro: deja en la parcela un montón de hortalizas y semillas, que lleva Transportar', () => {
  const w = farm();
  const s = w.survivors[0]!;
  s.work.haul = true;
  markPlot(w, 8, 6, true);
  w.plots[0]!.crop = { grown: GROW_HOURS, ripe: 3, dry: 0 };
  run(w, 3000, () => w.storage.items.veg > 0);
  expect(w.plots[0]!.crop).toBeNull();
  expect(w.storage.items.veg).toBeGreaterThanOrEqual(4); // con Cultivar 5
  expect(w.common.stats.harvested).toBe(w.storage.items.veg); // para el resumen final
  expect(w.storage.items.seeds).toBeGreaterThanOrEqual(1);
  expect(checkInvariants(w)).toEqual([]);
});

test('la cosecha según Cultivar: 3 con 0, 4 con 5, 5 con 10 y la fracción a veces', () => {
  expect(harvestVeg(0, 0)).toBe(3);
  expect(harvestVeg(5, 0.99)).toBe(4);
  expect(harvestVeg(10, 0.99)).toBe(5);
  expect(harvestVeg(2, 0.3)).toBe(4); // 3,4: con 0,3 < 0,4, una más
  expect(harvestVeg(2, 0.5)).toBe(3);
});

test('sin permiso para Cultivar, no hace nada en el huerto', () => {
  const w = farm();
  w.survivors[0]!.work.farm = false;
  w.storage.items.seeds = 3;
  markPlot(w, 8, 6, true);
  run(w, 1500);
  expect(w.plots[0]!.crop).toBeNull();
  expect(w.storage.items.seeds).toBe(3);
});

test('dos que cultivan no van a la misma parcela', () => {
  const w = farm();
  w.storage.items.seeds = 0;
  const [a] = w.survivors;
  a!.carrying.seeds = 2;
  markPlot(w, 8, 6, true);
  markPlot(w, 12, 9, true);
  const first = farmJob(a!, w);
  a!.action = first!;
  const b = {
    ...structuredClone(a!),
    id: 2,
    name: 'Bea',
    action: { type: 'idle' as const, ticksLeft: 0 },
  };
  w.survivors.push(b);
  const second = farmJob(b, w);
  expect(first?.type === 'moveTo' && first.then).toMatchObject({ type: 'tend', what: 'sow' });
  expect(second?.type === 'moveTo' && second.then).toMatchObject({ type: 'tend', what: 'sow' });
  const tile = (x: typeof first) =>
    x?.type === 'moveTo' && x.then?.type === 'tend' ? x.then.tile : -1;
  expect(tile(first)).not.toBe(tile(second));
});
