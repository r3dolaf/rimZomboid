// H4e §4: el trabajo Sanar — rescatar derribados (y llevarlos a una cama) y vendar.
import { expect, test } from 'vitest';
import { CARRY_SPEED, RESCUE_SAFE_RANGE, SURVIVOR_WALK_SPEED, TICKS_PER_DAY } from './balance';
import { contains } from './geom';
import { knockDown } from './body';
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
  knockDown(w, ana);
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
  knockDown(w, bea);
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
