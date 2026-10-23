// H5 §4: las vendas — cada uno lleva hasta 2, se venda solo lo que sangra, Sanar venda a los
// demás (y al derribado antes de cargarlo), y las vendas sucias se cambian.
import { expect, test } from 'vitest';
import {
  BANDAGE_CLEAN_HOURS,
  BANDAGE_TICKS,
  BANDAGES_CARRIED,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { addWound, knockDown } from './body';
import { brains } from './brain';
import { emptyInventory } from './items';
import { healJob } from './jobs/heal';
import { step } from './step';
import { addBase, addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import type { Survivor, World } from './types';
import { findWork } from './work';
import { tileOf } from './world';
import { newZombie } from './zombies/spawn';

/** Base en (2, 2)–(11, 9) con el almacén en (6, 8); Ana dentro, Bea fuera, en (20, 20). */
function world(): { w: World; ana: Survivor; bea: Survivor } {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2;
  w.storage.items.bandage = 5;
  const ana = w.survivors[0]!;
  ana.pos = { x: 4.5, y: 5.5 };
  const bea = addSurvivor(w, { x: 20, y: 20 });
  for (const s of [ana, bea]) s.work.heal = false; // salvo que el test lo pida
  return { w, ana, bea };
}

const until = (w: World, cond: () => boolean, max = 3000) => {
  for (let i = 0; i < max && !cond(); i++) step(w);
  return cond();
};

test('cifras: hasta 2 vendas encima; media hora con Sanar 5; limpia 1 día', () => {
  expect([BANDAGES_CARRIED, BANDAGE_TICKS, BANDAGE_CLEAN_HOURS]).toEqual([
    2,
    0.5 * TICKS_PER_HOUR,
    24,
  ]);
});

test('en la base, con menos de 2 vendas encima, va al almacén a por ellas', () => {
  const { w, ana, bea } = world();
  expect(findWork(ana, w)).toMatchObject({ type: 'moveTo', then: { type: 'takeBandages' } });
  expect(findWork(bea, w)?.type === 'moveTo' && findWork(bea, w)).not.toMatchObject({
    then: { type: 'takeBandages' },
  }); // fuera de la base, no
  expect(until(w, () => ana.carrying.bandage === BANDAGES_CARRIED)).toBe(true);
  expect(w.storage.items.bandage).toBe(3);
});

test('al descargar se queda con sus 2 vendas; con solo eso encima no va a descargar', () => {
  const { w, ana } = world();
  ana.carrying = { ...emptyInventory(), food: 3, bandage: 3 };
  ana.action = { type: 'unload', ticksLeft: 1 };
  step(w);
  expect(w.storage.items.food).toBeGreaterThanOrEqual(3);
  expect(ana.carrying.bandage).toBe(2);
  expect(w.storage.items.bandage).toBe(6);
  const job = findWork(ana, w);
  expect(job?.type === 'moveTo' ? job.then?.type : job?.type).not.toBe('unload');
});

test('vendarse: si le sangra una herida y lleva venda, allí mismo; luego deja de sangrar', () => {
  const { w, bea } = world();
  bea.carrying.bandage = 1;
  const wd = addWound(w, bea, 'leftArm', 'cut');
  expect(brains.ai.decide(bea, w)).toMatchObject({
    type: 'bandage',
    patientId: bea.id,
    woundId: wd.id,
  });
  expect(until(w, () => !wd.bleeding, 400)).toBe(true);
  expect(bea.carrying.bandage).toBe(0);
  expect(wd.cleanUntil).toBe(w.tick - 1 + BANDAGE_CLEAN_HOURS * TICKS_PER_HOUR);
  expect(
    w.log.some((e) => e.kind === 'bandaged' && e.survivorId === bea.id && e.otherId === bea.id),
  ).toBe(true);
  expect(tileOf(bea.pos)).toEqual({ x: 20, y: 20 }); // no se ha movido
});

test('sin vendas encima, va al almacén a por ellas y se venda', () => {
  const { w, ana, bea } = world();
  const wd = addWound(w, bea, 'leftArm', 'bite');
  expect(brains.ai.decide(bea, w)).toMatchObject({
    type: 'moveTo',
    then: { type: 'takeBandages' },
  });
  expect(until(w, () => !wd.bleeding)).toBe(true);
  expect(bea.carrying.bandage).toBe(1);
  // Ninguna se pierde: las 5 del almacén, menos la gastada (Ana también ha cogido las suyas).
  expect(w.storage.items.bandage + ana.carrying.bandage + bea.carrying.bandage).toBe(4);
});

test('huyendo o peleando, primero eso', () => {
  const { w, bea } = world();
  bea.carrying.bandage = 1;
  bea.stance = 'flee';
  addWound(w, bea, 'leftArm', 'cut');
  w.zombies.push(newZombie(w, { x: 23, y: 20 }));
  expect(brains.ai.decide(bea, w)).toMatchObject({ type: 'moveTo', run: true });
});

test('Sanar: a quien está en la base con una herida que sangra, con sus vendas', () => {
  const { w, ana, bea } = world();
  bea.work.heal = true;
  bea.pos = { x: 8.5, y: 5.5 };
  bea.carrying.bandage = 2;
  const wd = addWound(w, ana, 'torso', 'cut');
  ana.action = { type: 'sleep', inBed: false }; // que no se vende ella
  ana.needs.sleep = 0;
  expect(healJob(bea, w)).toMatchObject({
    type: 'moveTo',
    then: { type: 'bandage', patientId: ana.id },
  });
  expect(until(w, () => !wd.bleeding, 600)).toBe(true);
  expect(bea.carrying.bandage).toBeLessThanOrEqual(2); // gastó una (y quizá repuso)
  expect(
    w.log.some((e) => e.kind === 'bandaged' && e.survivorId === bea.id && e.otherId === ana.id),
  ).toBe(true);
});

test('Sanar sin vendas encima: primero al almacén', () => {
  const { w, ana, bea } = world();
  bea.work.heal = true;
  bea.pos = { x: 8.5, y: 5.5 };
  addWound(w, ana, 'torso', 'cut');
  expect(healJob(bea, w)).toMatchObject({ type: 'moveTo', then: { type: 'takeBandages' } });
});

test('venda sucia (pasado 1 día): Sanar la cambia', () => {
  const { w, ana, bea } = world();
  bea.work.heal = true;
  bea.pos = { x: 8.5, y: 5.5 };
  bea.carrying.bandage = 2;
  const wd = addWound(w, ana, 'torso', 'bite');
  wd.bleeding = false;
  wd.cleanUntil = w.tick - 1; // sucia
  expect(healJob(bea, w)).toMatchObject({ then: { type: 'bandage', patientId: ana.id } });
  wd.cleanUntil = w.tick + 10; // limpia: nada que hacer
  expect(healJob(bea, w)).toBeNull();
});

test('al derribado que sangra, el que va a rescatarlo le venda antes de cargarlo', () => {
  const { w, ana, bea } = world();
  bea.work.heal = true;
  bea.carrying.bandage = 2;
  ana.pos = { x: 22.5, y: 20.5 };
  const wd = addWound(w, ana, 'rightLeg', 'cut');
  knockDown(w, ana);
  expect(until(w, () => bea.carryingId === ana.id)).toBe(true);
  expect(wd.bleeding).toBe(false);
  expect(w.log.some((e) => e.kind === 'bandaged' && e.otherId === ana.id)).toBe(true);
});

test('con más nivel de Sanar se venda antes (nivel 10: un tercio menos)', () => {
  const { w, bea } = world();
  bea.carrying.bandage = 1;
  bea.skills.heal = { level: 10, xp: 0 };
  addWound(w, bea, 'leftLeg', 'cut'); // en la pierna: los brazos heridos también frenan
  const a = brains.ai.decide(bea, w);
  expect(a).toMatchObject({ type: 'bandage', ticksLeft: Math.round(BANDAGE_TICKS / 1.5) });
});
