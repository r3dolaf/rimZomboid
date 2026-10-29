// H5 §4: las vendas — cada uno lleva hasta 2, se venda solo lo que sangra, Sanar venda a los
// demás (y al derribado antes de cargarlo), y las vendas sucias se cambian.
import { expect, test } from 'vitest';
import {
  BANDAGE_CLEAN_HOURS,
  BANDAGE_TICKS,
  BANDAGES_CARRIED,
  HOSPITAL_HEAL,
  ITEM_WEIGHT_KG,
  LOOT,
  PAINKILLER_HOURS,
  REST_BELOW,
  REST_UNTIL,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { addWound, knockDown, refreshHealth } from './body';
import { healthSystem } from './health';
import { checkInvariants } from './invariants';
import { issue, ordersSystem } from './orders';
import { brains } from './brain';
import { emptyInventory, weightOf } from './items';
import { healJob } from './jobs/heal';
import { startPainkillerActivity, takeBandages } from './jobs/medical';
import { capacityKg } from './skills';
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
  // (H5b2: con su «Llevar siempre», que trae las 2 vendas de siempre.)
  expect(findWork(ana, w)).toMatchObject({ type: 'moveTo', then: { type: 'takeSupplies' } });
  expect(findWork(bea, w)?.type === 'moveTo' && findWork(bea, w)).not.toMatchObject({
    then: { type: 'takeSupplies' },
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

// --- Tarea 4: analgésicos, descanso y camas de hospital ---

test('analgésicos: objeto ligero que se encuentra sobre todo en la farmacia', () => {
  expect(ITEM_WEIGHT_KG.painkillers).toBe(0.05);
  expect(LOOT.pharmacy.painkillers).toEqual([6, 10]);
  expect(LOOT.police.painkillers).toEqual([1, 2]);
  expect(LOOT.supermarket.painkillers).toEqual([0, 2]);
  expect(LOOT.gas.painkillers).toEqual([0, 2]);
  expect(LOOT.house.painkillers).toEqual({ chance: 1 / 3 });
  expect([REST_BELOW, REST_UNTIL, PAINKILLER_HOURS]).toEqual([40, 50, 8]);
});

/** Ana con mucho dolor (Salud por debajo de 40) en la base: tres cortes recientes en el torso. */
function inPain() {
  const x = world();
  for (let i = 0; i < 3; i++) addWound(x.w, x.ana, 'torso', 'cut').bleeding = false;
  x.ana.carrying.bandage = 2;
  refreshHealth(x.w, x.ana);
  return x;
}

test('con mucho dolor, descansa: se acuesta en su cama y no trabaja hasta pasar de 50', () => {
  const { w, ana } = inPain();
  expect(ana.health).toBeLessThan(REST_BELOW);
  expect(brains.ai.decide(ana, w)).toMatchObject({
    type: 'moveTo',
    target: w.beds[0]!.pos,
    then: { type: 'rest' },
  });
  expect(until(w, () => ana.action.type === 'rest', 600)).toBe(true);
  for (let i = 0; i < 50; i++) step(w);
  expect(ana.action.type).toBe('rest');
  ana.wounds = [];
  step(w);
  step(w);
  expect(ana.action.type).not.toBe('rest');
});

test('Dar analgésico: si puede andar, va al almacén y se lo toma (8 h, el dolor a la mitad)', () => {
  const { w, ana } = inPain();
  w.storage.items.painkillers = 2;
  const pain = 100 - ana.health;
  issue(w, { type: 'givePainkiller', survivorId: ana.id });
  ordersSystem(w);
  expect(ana.painkillerWanted).toBe(true);
  expect(brains.ai.decide(ana, w)).toMatchObject({
    type: 'moveTo',
    then: { type: 'takePainkiller' },
  });
  expect(until(w, () => ana.painkillerUntil > w.tick, 600)).toBe(true);
  expect(w.storage.items.painkillers).toBe(1);
  expect(ana.painkillerWanted).toBe(false);
  expect(ana.painkillerUntil - w.tick).toBeGreaterThan(PAINKILLER_HOURS * TICKS_PER_HOUR - 20);
  refreshHealth(w, ana);
  expect(100 - ana.health).toBeLessThan(pain * 0.6);
  // Con analgésico no descansa por dolor aunque le duela.
  ana.painkillerUntil = w.tick + 1000;
  for (let i = 0; i < 5; i++) addWound(w, ana, 'torso', 'scratch').bleeding = false;
  refreshHealth(w, ana);
  expect(ana.health).toBeLessThan(REST_BELOW * 2);
  const a = brains.ai.decide(ana, w);
  expect(a?.type === 'moveTo' ? a.then?.type : a?.type).not.toBe('rest');
});

test('si no puede moverse, se lo lleva uno con Sanar', () => {
  const { w, ana, bea } = inPain();
  w.storage.items.painkillers = 1;
  w.beds[0]!.pos = { x: 3, y: 3 }; // en la base, y Ana derribada en ella
  ana.pos = { x: 3.5, y: 3.5 };
  knockDown(w, ana);
  if (ana.action.type === 'downed') ana.action.inBed = true;
  bea.work.heal = true;
  bea.pos = { x: 8.5, y: 6.5 };
  issue(w, { type: 'givePainkiller', survivorId: ana.id });
  ordersSystem(w);
  expect(healJob(bea, w)).toMatchObject({
    type: 'moveTo',
    then: { type: 'fetchPainkiller', patientId: ana.id },
  });
  expect(until(w, () => ana.painkillerUntil > w.tick, 800)).toBe(true);
  expect(w.storage.items.painkillers).toBe(0);
  expect(bea.carrying.painkillers).toBe(0);
  expect(
    w.log.some((e) => e.kind === 'painkiller' && e.survivorId === bea.id && e.otherId === ana.id),
  ).toBe(true);
});

test('sin analgésicos en el almacén, la orden no hace nada', () => {
  const { w, ana } = inPain();
  issue(w, { type: 'givePainkiller', survivorId: ana.id });
  ordersSystem(w);
  expect(ana.painkillerWanted).toBe(false);
});

test('cama de hospital: deja de tener dueño (que se queda sin cama) y nadie más se la queda', () => {
  const { w, ana } = world();
  const bed = w.beds[0]!;
  expect(bed.ownerId).toBe(ana.id);
  issue(w, { type: 'setMedical', bedId: bed.id, on: true });
  ordersSystem(w);
  expect(bed).toMatchObject({ medical: true, ownerId: null });
  expect(ana.bedId).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
  // Si deja de serlo, vuelve a quedar libre y alguien sin cama se la queda.
  issue(w, { type: 'setMedical', bedId: bed.id, on: false });
  ordersSystem(w);
  expect(bed.medical).toBe(false);
  expect(bed.ownerId).not.toBeNull();
});

test('el que descansa, primero a una cama de hospital libre; el rescatado, también', () => {
  const { w, ana, bea } = inPain();
  w.beds.push({ id: 9, pos: { x: 9, y: 3 }, ownerId: null, medical: true });
  expect(brains.ai.decide(ana, w)).toMatchObject({
    target: { x: 9, y: 3 },
    then: { type: 'rest' },
  });
  // Con la cama ya ocupada, a la suya.
  ana.pos = { x: 9.5, y: 3.5 };
  ana.action = { type: 'rest' };
  bea.pos = { x: 25.5, y: 20.5 };
  bea.work.heal = false;
  const cris = addSurvivor(w, { x: 22, y: 20 }, 'Cris');
  cris.work.heal = true;
  cris.carrying.bandage = 2;
  knockDown(w, bea);
  w.beds.push({ id: 10, pos: { x: 10, y: 3 }, ownerId: null, medical: true });
  expect(until(w, () => bea.action.type === 'downed' && bea.action.inBed === true, 2000)).toBe(
    true,
  );
  expect(tileOf(bea.pos)).toEqual({ x: 10, y: 3 });
});

test('en una cama de hospital se cura el triple y recupera el triple de sangre (6 por hora)', () => {
  expect(HOSPITAL_HEAL).toBe(3);
  const { w, ana } = world();
  w.beds.push({ id: 9, pos: { x: 9, y: 3 }, ownerId: null, medical: true });
  ana.pos = { x: 9.5, y: 3.5 };
  ana.action = { type: 'rest' };
  const wd = addWound(w, ana, 'torso', 'cut');
  wd.bleeding = false;
  ana.blood = 50;
  for (let i = 0; i < TICKS_PER_HOUR; i++) {
    healthSystem(w);
    w.tick++;
  }
  expect(ana.blood).toBeCloseTo(56, 5);
  expect(6 - wd.damage).toBeCloseTo((6 * 3) / 72, 5);
});

test('Sanar atiende primero a quien está en una cama de hospital', () => {
  const { w, ana, bea } = world();
  bea.work.heal = true;
  bea.carrying.bandage = 2;
  bea.pos = { x: 5.5, y: 6.5 };
  const cris = addSurvivor(w, { x: 9, y: 3 }, 'Cris');
  w.beds.push({ id: 9, pos: { x: 9, y: 3 }, ownerId: null, medical: true });
  cris.action = { type: 'rest' };
  addWound(w, ana, 'torso', 'cut'); // Ana, más cerca, pero de pie
  addWound(w, cris, 'torso', 'cut');
  ana.action = { type: 'sleep', inBed: false };
  ana.needs.sleep = 0;
  expect(healJob(bea, w)).toMatchObject({ then: { type: 'bandage', patientId: cris.id } });
});

test('si cae derribado acostado en una cama (durmiendo o descansando), sigue en ella', () => {
  const { w, ana } = world();
  w.beds.push({ id: 9, pos: { x: 9, y: 3 }, ownerId: null, medical: true });
  ana.pos = { x: 9.5, y: 3.5 };
  ana.action = { type: 'rest' };
  knockDown(w, ana);
  expect(ana.action).toMatchObject({ type: 'downed', inBed: true });
  ana.action = { type: 'sleep', inBed: true };
  knockDown(w, ana);
  expect(ana.action).toMatchObject({ type: 'downed', inBed: true });
  ana.action = { type: 'idle', ticksLeft: 0 }; // de pie en la casilla de la cama, no
  knockDown(w, ana);
  expect(ana.action).toEqual({ type: 'downed', until: w.tick + 4 * TICKS_PER_HOUR });
});

test('a por vendas o un analgésico, solo lo que le cabe (nunca pasa de lo que puede cargar)', () => {
  const { w, ana, bea } = world();
  ana.carrying.wood = Math.floor(capacityKg(ana) / ITEM_WEIGHT_KG.wood); // lleno de tablas
  ana.carrying.bandage = 0;
  const room = capacityKg(ana) - weightOf(ana.carrying);
  takeBandages(ana, w);
  expect(ana.carrying.bandage).toBe(Math.min(2, Math.floor(room / ITEM_WEIGHT_KG.bandage + 1e-9)));
  expect(weightOf(ana.carrying)).toBeLessThanOrEqual(capacityKg(ana) + 1e-9);
  // El que lleva el analgésico, igual.
  bea.carrying.wood = Math.floor(capacityKg(bea) / ITEM_WEIGHT_KG.wood);
  bea.carrying.bandage = 0;
  bea.carrying.cloth = Math.floor(
    (capacityKg(bea) - weightOf(bea.carrying)) / ITEM_WEIGHT_KG.cloth,
  );
  w.storage.items.painkillers = 1;
  knockDown(w, ana);
  ana.painkillerWanted = true;
  if (weightOf(bea.carrying) + ITEM_WEIGHT_KG.painkillers > capacityKg(bea)) {
    startPainkillerActivity(bea, w, { type: 'fetchPainkiller', patientId: ana.id });
    expect(bea.carrying.painkillers).toBe(0);
    expect(w.storage.items.painkillers).toBe(1);
  }
  expect(checkInvariants(w).filter((p) => p.includes('carga'))).toEqual([]);
});

test('sangrando y sin sitio para vendas: no va y viene a por ellas, primero descarga', () => {
  const { w, ana } = world();
  ana.carrying.bandage = 0;
  ana.carrying.wood = Math.floor(capacityKg(ana) / ITEM_WEIGHT_KG.wood);
  ana.carrying.cloth = Math.floor(
    (capacityKg(ana) - weightOf(ana.carrying)) / ITEM_WEIGHT_KG.cloth,
  );
  addWound(w, ana, 'leftLeg', 'cut');
  const a = brains.ai.decide(ana, w);
  expect(a?.type === 'moveTo' ? a.then?.type : a?.type).toBe('unload');
});
