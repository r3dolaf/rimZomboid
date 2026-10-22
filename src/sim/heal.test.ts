// H4e §4: el trabajo Sanar — rescatar derribados (y llevarlos a una cama) y vendar.
import { expect, test } from 'vitest';
import {
  BANDAGE_BELOW,
  BANDAGE_HEAL,
  BANDAGE_HOURS,
  BANDAGE_PER_LEVEL,
  BANDAGE_TICKS,
  CARRY_SPEED,
  GET_UP_HEALTH_BED,
  RESCUE_SAFE_RANGE,
  SURVIVOR_WALK_SPEED,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { contains } from './geom';
import { healthSystem, hurtSurvivor } from './health';
import { checkInvariants } from './invariants';
import { carrySystem, healJob } from './jobs/heal';
import { issue, ordersSystem } from './orders';
import { SKILLS } from './skills';
import { step } from './step';
import { addBase, addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import type { Survivor, World } from './types';
import { defaultPriorities, defaultWork, tileOf } from './world';
import { newZombie } from './zombies/spawn';
import { dangerDecision } from './danger';

/** Base en (2, 2)–(11, 9); Ana (con cama en la base) derribada fuera, en (25, 20); Bea en (20, 20). */
function world(): { w: World; ana: Survivor; bea: Survivor } {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2; // de día
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 20, y: 20 }); // antes de derribar a Ana (se copia de ella)
  ana.pos = { x: 25.5, y: 20.5 };
  hurtSurvivor(w, ana, 200);
  return { w, ana, bea };
}

test('Sanar: un trabajo con su habilidad, para todos (también el Cobarde) y con prioridad 1', () => {
  expect(SKILLS).toContain('heal');
  expect(defaultWork(['coward']).heal).toBe(true);
  expect(defaultWork([]).heal).toBe(true);
  expect(defaultPriorities()).toMatchObject({ heal: 1, build: 3, loot: 3 });
});

test('rescatar: va a por el derribado que está fuera', () => {
  const { w, ana, bea } = world();
  expect(healJob(bea, w)).toEqual({
    type: 'moveTo',
    target: tileOf(ana.pos),
    then: { type: 'rescue', downedId: ana.id },
  });
});

test('rescatar: no sale si algún colono ve un zombi a 8 casillas o menos del derribado', () => {
  expect(RESCUE_SAFE_RANGE).toBe(8);
  const { w, bea } = world();
  w.zombies.push(newZombie(w, { x: 28, y: 20 }));
  expect(healJob(bea, w)).toBeNull();
  w.zombies[0]!.pos = { x: 35.5, y: 20.5 }; // a 10
  expect(healJob(bea, w)).not.toBeNull();
});

test('rescatar: no al que ya está en cama, al que lleva otro ni al que otro va a rescatar', () => {
  const { w, ana, bea } = world();
  const cris = addSurvivor(w, { x: 22, y: 22 }, 'Cris');
  cris.action = {
    type: 'moveTo',
    target: tileOf(ana.pos),
    then: { type: 'rescue', downedId: ana.id },
  };
  expect(healJob(bea, w)).toBeNull();
  cris.action = { type: 'idle', ticksLeft: 0 };
  if (ana.action.type === 'downed') ana.action.inBed = true;
  expect(healJob(bea, w)).toBeNull();
});

test('rescatar: al que está en la base sin cama a la que llevarlo, no hace falta', () => {
  const { w, ana, bea } = world();
  ana.pos = { x: 6.5, y: 6.5 };
  expect(healJob(bea, w)).not.toBeNull(); // a su cama
  w.beds[0]!.ownerId = bea.id; // su cama ya no es suya, y no hay otra
  bea.bedId = w.beds[0]!.id;
  ana.bedId = null;
  expect(healJob(bea, w)).toBeNull();
  ana.pos = { x: 25.5, y: 20.5 }; // fuera, sí: al suelo de la base
  expect(healJob(bea, w)).not.toBeNull();
});

test('lo lleva a su cama, despacio y con él; al dejarlo, "en cama" y al registro', () => {
  const { w, ana, bea } = world();
  let carried = 0;
  for (let i = 0; i < 1000 && ana.action.type === 'downed' && !ana.action.inBed; i++) {
    const before = { ...bea.pos };
    step(w);
    expect(checkInvariants(w)).toEqual([]);
    if (bea.carryingId === ana.id) {
      carried++;
      expect(ana.pos).toEqual(bea.pos);
      const moved = Math.hypot(bea.pos.x - before.x, bea.pos.y - before.y);
      expect(moved).toBeLessThanOrEqual(SURVIVOR_WALK_SPEED * CARRY_SPEED + 1e-9);
    }
  }
  expect(carried).toBeGreaterThan(50);
  expect(ana.action).toMatchObject({ type: 'downed', inBed: true });
  expect(tileOf(ana.pos)).toEqual(w.beds[0]!.pos);
  expect(bea.carryingId).toBeNull();
  expect(
    w.log.some((e) => e.kind === 'rescued' && e.survivorId === bea.id && e.otherId === ana.id),
  ).toBe(true);
  expect(bea.skills.heal.xp + bea.skills.heal.level).toBeGreaterThan(5);
});

test('en cama se levanta a su hora con 40 de Salud (en el suelo, con 15)', () => {
  expect(GET_UP_HEALTH_BED).toBe(40);
  const { w, ana } = world();
  if (ana.action.type !== 'downed') throw new Error();
  ana.action.inBed = true;
  w.tick = ana.action.until;
  healthSystem(w);
  expect(ana.health).toBe(40);
});

/** Bea ya lleva a Ana, de camino a la base. */
function carrying(): { w: World; ana: Survivor; bea: Survivor } {
  const out = world();
  const { w, ana, bea } = out;
  ana.pos = { x: 20.5, y: 21.5 };
  bea.action = healJob(bea, w)!;
  bea.pos = { x: 20.5, y: 21.5 };
  bea.path = [];
  for (let i = 0; i < 5 && bea.carryingId === null; i++) step(w);
  expect(bea.carryingId).toBe(ana.id);
  return out;
}

test('con zombis: si le toca pelear, lo suelta y pelea; si le toca huir, sigue cargándolo', () => {
  const a = carrying();
  a.w.zombies.push(newZombie(a.w, { x: 22, y: 21 }));
  a.bea.stance = 'fight';
  const fight = dangerDecision(a.bea, a.w);
  expect(fight).toMatchObject({ type: 'melee' });
  a.bea.action = fight!;
  carrySystem(a.w);
  expect(a.bea.carryingId).toBeNull();
  expect(a.ana.action).toMatchObject({ type: 'downed' });
  expect(a.ana.action.type === 'downed' && a.ana.action.carriedBy).toBeUndefined();
  expect(checkInvariants(a.w)).toEqual([]);

  const b = carrying();
  b.w.zombies.push(newZombie(b.w, { x: 23, y: 21 }));
  b.bea.stance = 'flee';
  expect(dangerDecision(b.bea, b.w)).toBeNull(); // sigue con lo suyo: llevarlo a la base
  carrySystem(b.w);
  expect(b.bea.carryingId).toBe(b.ana.id);
});

test('si derriban al que lo lleva, el derribado queda en el suelo donde iba', () => {
  const { w, ana, bea } = carrying();
  hurtSurvivor(w, bea, 200);
  carrySystem(w);
  expect(bea.carryingId).toBeNull();
  expect(ana.action.type === 'downed' && ana.action.carriedBy).toBeUndefined();
  expect(checkInvariants(w)).toEqual([]);
});

test('en modo combate se le puede mandar rescatar, aunque haya zombis cerca', () => {
  const { w, ana, bea } = world();
  w.zombies.push(newZombie(w, { x: 27, y: 20 }));
  issue(w, { type: 'draft', survivorIds: [bea.id], on: true });
  issue(w, { type: 'draftRescue', survivorId: bea.id, downedId: ana.id });
  ordersSystem(w);
  expect(bea.action).toMatchObject({ type: 'moveTo', then: { type: 'rescue', downedId: ana.id } });
  expect(bea.path.length).toBeGreaterThan(0);
  for (let i = 0; i < 600 && !(ana.action.type === 'downed' && ana.action.inBed); i++) {
    w.zombies = []; // que no se meta en medio
    step(w);
  }
  expect(ana.action).toMatchObject({ type: 'downed', inBed: true });
  expect(bea.drafted).toBe(true);
  expect(contains(w.base.rect, tileOf(bea.pos))).toBe(true);
});

test('invariantes: el llevado está derribado, con quien lo lleva y en su sitio', () => {
  const { w, ana, bea } = carrying();
  expect(checkInvariants(w)).toEqual([]);
  ana.pos = { x: 30.5, y: 30.5 };
  expect(checkInvariants(w).join()).toMatch(/lleva a Ana/);
  ana.pos = { ...bea.pos };
  if (ana.action.type === 'downed') delete ana.action.carriedBy;
  expect(checkInvariants(w).join()).toMatch(/lleva a Ana/);
});

// --- Tarea 5: vendar ---

/** Ana herida (30 de Salud) y Bea, las dos en la base; 2 vendas en el almacén. */
function hurt(): { w: World; ana: Survivor; bea: Survivor } {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2;
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 8, y: 6 });
  ana.pos = { x: 5.5, y: 6.5 };
  ana.health = 30;
  w.storage.items.bandage = 2;
  return { w, ana, bea };
}

test('vendar: a quien está en la base con menos de 50 de Salud', () => {
  expect(BANDAGE_BELOW).toBe(50);
  const { w, ana, bea } = hurt();
  expect(healJob(bea, w)).toEqual({
    type: 'moveTo',
    target: tileOf(ana.pos),
    then: { type: 'bandage', patientId: ana.id },
  });
});

test('vendar: no con 50 o más, fuera de la base, derribado, con venda reciente o sin vendas', () => {
  const cases: ((x: ReturnType<typeof hurt>) => void)[] = [
    ({ ana }) => (ana.health = 50),
    ({ ana }) => (ana.pos = { x: 25.5, y: 20.5 }),
    ({ w, ana }) => (ana.bandagedUntil = w.tick + 1),
    ({ w }) => (w.storage.items.bandage = 0),
    ({ w, ana }) => {
      ana.health = 0;
      ana.action = { type: 'downed', until: w.tick + 100, inBed: true };
    },
    ({ w, ana }) => {
      const cris = addSurvivor(w, { x: 4, y: 4 }, 'Cris');
      cris.health = 100;
      cris.action = {
        type: 'moveTo',
        target: tileOf(ana.pos),
        then: { type: 'bandage', patientId: ana.id },
      };
    },
  ];
  for (const change of cases) {
    const x = hurt();
    change(x);
    expect(healJob(x.bea, x.w)).toBeNull();
  }
});

test('vendar: también a sí mismo', () => {
  const { w, ana, bea } = hurt();
  ana.health = 100;
  bea.health = 20;
  expect(healJob(bea, w)).toMatchObject({ type: 'bandage', patientId: bea.id });
});

test('vendar: media hora; +15 de Salud y 1 más por nivel; gasta una venda y dura 12 h', () => {
  expect([BANDAGE_HEAL, BANDAGE_PER_LEVEL, BANDAGE_HOURS]).toEqual([15, 1, 12]);
  const { w, ana, bea } = hurt();
  bea.skills.heal = { level: 4, xp: 0 };
  ana.action = { type: 'idle', ticksLeft: 1e9 }; // quieta
  ana.work.heal = false; // que no se vende ella
  let ticks = 0;
  const start = ana.health;
  for (; ticks < 400 && w.storage.items.bandage === 2; ticks++) step(w);
  expect(w.storage.items.bandage).toBe(1);
  // + 19 por la venda y lo poco que se cura sola mientras tanto (1 por hora despierta).
  expect(ana.health - start).toBeGreaterThanOrEqual(19);
  expect(ana.health - start).toBeLessThan(21);
  expect(ana.bandagedUntil).toBe(w.tick - 1 + BANDAGE_HOURS * TICKS_PER_HOUR);
  expect(
    w.log.some((e) => e.kind === 'bandaged' && e.survivorId === bea.id && e.otherId === ana.id),
  ).toBe(true);
  expect(ticks).toBeGreaterThanOrEqual(BANDAGE_TICKS);
  expect(checkInvariants(w)).toEqual([]);
});

test('vendado, la Salud sube el doble de rápido durante 12 h', () => {
  const { w, ana } = hurt();
  ana.action = { type: 'idle', ticksLeft: 1e9 };
  const perHour = () => {
    const h = ana.health;
    for (let i = 0; i < TICKS_PER_HOUR; i++) healthSystem(w);
    return ana.health - h;
  };
  const plain = perHour();
  ana.bandagedUntil = w.tick + 1e6;
  expect(perHour()).toBeCloseTo(2 * plain, 6);
});

test('si se acaban las vendas mientras venda, no hay vendaje', () => {
  const { w, ana, bea } = hurt();
  bea.action = { type: 'bandage', patientId: ana.id, ticksLeft: 1 };
  w.storage.items.bandage = 0;
  const h = ana.health;
  step(w);
  expect(ana.health).toBeLessThan(h + 1);
  expect(ana.bandagedUntil).toBe(0);
});
