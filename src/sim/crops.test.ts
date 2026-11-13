// V4 §2: cada cultivo crece, se para y se hiela con su temperatura; se siembra lo elegido en cada
// parcela, y solo con su semilla y el tiempo que le toca.
import { expect, test } from 'vitest';
import { CROPS, TICKS_PER_HOUR } from './balance';
import { dayStart } from './clock';
import { cropStage, farmSystem, markPlot } from './farm';
import { emptyInventory } from './items';
import { farmJob, farmStillWorth, harvestCount, tendStep } from './jobs/farm';
import { dayMean, outdoorTemp } from './season';
import { step } from './step';
import { addBase, emptyWorld } from './testing/fixtures';
import type { CropKind, World } from './types';
import { findWork } from './work';

/** Hierba de 16×12 con la base a la izquierda, todo visto; Ana solo cultiva; el día 3 a las 10. */
function farm(): World {
  const w = addBase(emptyWorld(16, 12), { x: 0, y: 0, w: 5, h: 5 });
  w.seen.fill(1);
  const s = w.survivors[0]!;
  s.pos = { x: 2.5, y: 2.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'farm';
  w.storage.items = emptyInventory();
  w.tick = dayStart(3) + 10 * TICKS_PER_HOUR;
  return w;
}

/** La temperatura de fuera en `t` durante la próxima hora. */
function setTemp(w: World, t: number): void {
  w.common.tempShift = null;
  w.common.tempShift = { value: t - outdoorTemp(w), until: w.tick + TICKS_PER_HOUR + 1 };
}

/** La media del día en `t` (para sembrar). */
function setDayMean(w: World, t: number): void {
  w.common.tempShift = null;
  w.common.tempShift = { value: t - dayMean(w), until: Number.MAX_SAFE_INTEGER };
}

/** Una parcela en (8, 6) de ese cultivo, sembrada con esas horas y húmeda. */
function sown(w: World, kind: CropKind, grown: number) {
  markPlot(w, 8, 6, true, kind);
  const p = w.plots[0]!;
  p.crop = { kind, grown, ripe: 0, dry: 0 };
  p.moisture = 20;
  return p;
}

test('cada cultivo madura con sus horas: la lechuga a las 96 y la col a las 216', () => {
  expect(CROPS.lettuce.hours).toBe(96);
  expect(CROPS.cabbage.hours).toBe(216);
  const w = farm();
  const p = sown(w, 'lettuce', 95);
  setTemp(w, 15);
  farmSystem(w);
  expect(cropStage(p)).toBe('ripe');
  const w2 = farm();
  const q = sown(w2, 'cabbage', 95);
  setTemp(w2, 15);
  farmSystem(w2);
  expect(cropStage(q)).toBe('growing');
  q.crop!.grown = 215;
  setTemp(w2, 15);
  farmSystem(w2);
  expect(cropStage(q)).toBe('ripe');
});

test('con 3 grados la col crece y la lechuga se para', () => {
  const w = farm();
  const p = sown(w, 'cabbage', 10);
  setTemp(w, 3);
  farmSystem(w);
  expect(p.crop!.grown).toBe(11);
  const w2 = farm();
  const q = sown(w2, 'lettuce', 10);
  setTemp(w2, 3);
  farmSystem(w2);
  expect(q.crop!.grown).toBe(10);
});

test('a −4 la lechuga se hiela y la col no; a −7, también la col; el registro dice cuál', () => {
  const w = farm();
  sown(w, 'lettuce', 10);
  setTemp(w, -4);
  farmSystem(w);
  expect(w.plots[0]!.crop).toBeNull();
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'cropsFrozen', n: 1, crops: ['lettuce'] });
  const w2 = farm();
  const q = sown(w2, 'cabbage', 10);
  setTemp(w2, -4);
  farmSystem(w2);
  expect(q.crop).not.toBeNull();
  setTemp(w2, -7);
  farmSystem(w2);
  expect(q.crop).toBeNull();
});

test('con el día a 10 grados se siembran lechuga y patata, no tomate; con 4, solo col', () => {
  const plant = (kind: CropKind, mean: number) => {
    const w = farm();
    markPlot(w, 8, 6, true, kind);
    w.storage.items[CROPS[kind].seeds] = 3;
    setDayMean(w, mean);
    return farmJob(w.survivors[0]!, w) !== null;
  };
  expect(plant('lettuce', 10)).toBe(true);
  expect(plant('potato', 10)).toBe(true);
  expect(plant('tomato', 10)).toBe(false);
  expect(plant('tomato', 15)).toBe(true);
  expect(plant('cabbage', 4)).toBe(true);
  expect(plant('potato', 4)).toBe(false);
});

test('una parcela de col solo se siembra con semillas de col (y va a por ellas)', () => {
  const w = farm();
  markPlot(w, 8, 6, true, 'cabbage');
  const s = w.survivors[0]!;
  s.carrying.seedsPotato = 3;
  expect(farmJob(s, w)).toBeNull(); // con patatas de siembra, no
  w.storage.items.seedsCabbage = 2;
  expect(farmJob(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'takeSeeds' } });
  for (let i = 0; i < 3000 && !w.plots[0]!.crop; i++) step(w);
  expect(w.plots[0]!.crop?.kind).toBe('cabbage');
  expect(w.storage.items.seedsCabbage + s.carrying.seedsCabbage).toBe(1);
});

test('lo que da cada cosecha: su base por (1 + nivel/15), la fracción a veces', () => {
  expect(harvestCount('tomato', 0, 0.99)).toBe(5);
  expect(harvestCount('lettuce', 15, 0)).toBe(4);
  expect(harvestCount('potato', 5, 0.99)).toBe(5); // 4 × 4/3 = 5,33: la fracción, no
  expect(harvestCount('potato', 5, 0)).toBe(6); // y sí
});

test('al cosechar queda su hortaliza y 1 o 2 de sus semillas', () => {
  const w = farm();
  const p = sown(w, 'tomato', CROPS.tomato.hours);
  const s = w.survivors[0]!;
  s.pos = { x: 8.5, y: 6.5 };
  const a = { type: 'tend' as const, tile: p.tile, what: 'harvest' as const, ticksLeft: 1 };
  s.action = a;
  tendStep(w, s, a);
  const pile = w.piles[0]!.items;
  expect(pile.tomato).toBeGreaterThanOrEqual(5);
  expect(pile.seedsTomato).toBeGreaterThanOrEqual(1);
  expect(pile.seedsTomato).toBeLessThanOrEqual(2);
  expect(pile.potato + pile.seedsPotato).toBe(0);
});

test('si la parcela pasa a otro cultivo mientras va a sembrarla, deja de ir y no siembra lo que no toca', () => {
  const w = farm();
  markPlot(w, 8, 6, true, 'potato');
  const s = w.survivors[0]!;
  s.carrying.seedsPotato = 2;
  const job = farmJob(s, w)!;
  expect(job).toMatchObject({ type: 'moveTo', then: { type: 'tend', what: 'sow' } });
  s.action = job;
  expect(farmStillWorth(s, w)).toBe(true);
  markPlot(w, 8, 6, true, 'cabbage');
  expect(w.plots[0]!.kind).toBe('cabbage');
  expect(farmStillWorth(s, w)).toBe(false);
  // Aunque llegue y empiece, no siembra patata en la parcela de col.
  const a = { type: 'tend' as const, tile: w.plots[0]!.tile, what: 'sow' as const, ticksLeft: 1 };
  s.pos = { x: 8.5, y: 6.5 };
  s.action = a;
  tendStep(w, s, a);
  expect(w.plots[0]!.crop).toBeNull();
  expect(s.carrying.seedsPotato).toBe(2);
});

test('con semillas que ya no sirven (no queda parcela de ese cultivo), las devuelve al almacén', () => {
  const w = farm();
  markPlot(w, 8, 6, true, 'potato');
  const s = w.survivors[0]!;
  s.carrying.seedsTomato = 3;
  expect(findWork(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'unload' } });
});

test('marcar una parcela ya marcada con otro cultivo lo cambia; lo sembrado sigue', () => {
  const w = farm();
  markPlot(w, 8, 6, true, 'lettuce');
  w.plots[0]!.crop = { kind: 'lettuce', grown: 5, ripe: 0, dry: 0 };
  markPlot(w, 8, 6, true, 'cabbage');
  expect(w.plots).toHaveLength(1);
  expect(w.plots[0]!.kind).toBe('cabbage');
  expect(w.plots[0]!.crop?.kind).toBe('lettuce');
  markPlot(w, 9, 6, true);
  expect(w.plots[1]!.kind).toBe('potato'); // sin decir cuál, patata
});

test('sin semillas de lo que pide una parcela vacía, se avisa una vez (y otra si vuelve a faltar)', () => {
  const w = farm();
  markPlot(w, 8, 6, true, 'cabbage');
  setTemp(w, 10);
  setDayMean(w, 10);
  farmSystem(w);
  expect(w.common.log.filter((e) => e.kind === 'noSeeds')).toEqual([
    expect.objectContaining({ kind: 'noSeeds', crop: 'cabbage' }),
  ]);
  w.tick += TICKS_PER_HOUR;
  farmSystem(w);
  expect(w.common.log.filter((e) => e.kind === 'noSeeds')).toHaveLength(1);
  // Con semillas, deja de faltar; si vuelven a faltar, otro aviso.
  w.storage.items.seedsCabbage = 1;
  w.tick += TICKS_PER_HOUR;
  farmSystem(w);
  w.storage.items.seedsCabbage = 0;
  w.tick += TICKS_PER_HOUR;
  farmSystem(w);
  expect(w.common.log.filter((e) => e.kind === 'noSeeds')).toHaveLength(2);
  // Quien las lleva encima, cuenta.
  const w2 = farm();
  markPlot(w2, 8, 6, true, 'potato');
  w2.survivors[0]!.carrying.seedsPotato = 1;
  setDayMean(w2, 15);
  farmSystem(w2);
  expect(w2.common.log.some((e) => e.kind === 'noSeeds')).toBe(false);
});
