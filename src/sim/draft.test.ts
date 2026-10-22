// H4e §3.1: el modo combate en la simulación — órdenes, qué hace solo y cuándo sale.
import { expect, test } from 'vitest';
import { MOOD_CRISIS, SURVIVOR_WALK_SPEED, TICKS_PER_DAY } from './balance';
import { combatSystem } from './combat';
import { hurtSurvivor } from './health';
import { checkInvariants } from './invariants';
import { isWalkable, setTile } from './map/grid';
import { issue, ordersSystem } from './orders';
import { needsConsoling } from './consoling';
import { isAvailable } from './social';
import { decisionsSystem } from './systems/decisions';
import { movementSystem } from './systems/movement';
import { addBase, addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type World } from './types';
import { tileOf } from './world';
import { newZombie } from './zombies/spawn';

function world(): World {
  const w = addBase(emptyWorld(30, 30), { x: 1, y: 1, w: 6, h: 6 });
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2; // de día
  w.survivors[0]!.pos = { x: 10.5, y: 10.5 };
  return w;
}

const draft = (w: World, ss: Survivor[], on = true) => {
  issue(w, { type: 'draft', survivorIds: ss.map((s) => s.id), on });
  ordersSystem(w);
};

test('poner el modo combate: deja lo que hacía (también dormir) y se queda quieto', () => {
  const w = world();
  const a = w.survivors[0]!;
  a.action = { type: 'sleep', inBed: false };
  const b = addSurvivor(w, { x: 12, y: 10 });
  b.action = { type: 'moveTo', target: { x: 20, y: 20 } };
  b.path = [{ x: 13, y: 11 }];
  draft(w, [a, b]);
  for (const s of [a, b]) {
    expect(s.drafted).toBe(true);
    expect(s.action).toEqual({ type: 'idle', ticksLeft: 0 });
    expect(s.path).toEqual([]);
  }
  draft(w, [a], false);
  expect(a.drafted).toBe(false);
  expect(b.drafted).toBe(true);
});

test('no se puede a quien está derribado ni a quien está en crisis', () => {
  const w = world();
  const a = w.survivors[0]!;
  a.health = 0;
  a.action = { type: 'downed', until: 1e9 };
  const b = addSurvivor(w, { x: 12, y: 10 });
  b.action = { type: 'crisis', ticksLeft: 100 };
  const c = addSurvivor(w, { x: 14, y: 10 });
  c.action = { type: 'moveTo', target: { x: 3, y: 3 }, then: { type: 'crisis' } };
  draft(w, [a, b, c]);
  expect([a, b, c].map((s) => s.drafted)).toEqual([false, false, false]);
  expect(b.action.type).toBe('crisis');
});

test('al ponerlo, lo que era de dos se corta también para el otro', () => {
  const w = world();
  const a = w.survivors[0]!;
  const b = addSurvivor(w, { x: 11, y: 10 });
  a.action = { type: 'console', otherId: b.id, ticksLeft: 10 };
  b.action = { type: 'consoled', otherId: a.id, crisisLeft: 40 };
  draft(w, [a]);
  expect(b.action).toEqual({ type: 'crisis', ticksLeft: 40 }); // sigue con su crisis
  expect(checkInvariants(w)).toEqual([]);
  const c = addSurvivor(w, { x: 12, y: 12 });
  const d = addSurvivor(w, { x: 13, y: 12 });
  c.action = { type: 'fight', otherId: d.id, ticksLeft: 10 };
  d.action = { type: 'fight', otherId: c.id, ticksLeft: 10 };
  draft(w, [d]);
  expect(c.action).toEqual({ type: 'idle', ticksLeft: 0 });
  expect(checkInvariants(w)).toEqual([]);
});

test('ir: cada uno a una casilla libre distinta junto al punto, andando', () => {
  const w = world();
  const ss = [w.survivors[0]!, addSurvivor(w, { x: 11, y: 10 }), addSurvivor(w, { x: 12, y: 10 })];
  setTile(w.grid, 20, 20, Tile.Wall); // el punto mismo no se pisa
  const idle = addSurvivor(w, { x: 3, y: 3 }); // este no está en modo combate
  draft(w, ss);
  issue(w, { type: 'draftMove', survivorIds: [...ss, idle].map((s) => s.id), x: 20, y: 20 });
  ordersSystem(w);
  const targets = ss.map((s) => (s.action.type === 'moveTo' ? s.action.target : null));
  expect(new Set(targets.map((t) => `${t!.x},${t!.y}`)).size).toBe(3);
  for (const t of targets) {
    expect(isWalkable(w.grid, t!.x, t!.y)).toBe(true);
    expect(Math.max(Math.abs(t!.x - 20), Math.abs(t!.y - 20))).toBeLessThanOrEqual(1);
  }
  for (const s of ss) expect(s.path.length).toBeGreaterThan(0);
  expect(idle.action.type).toBe('idle');
  const s = ss[0]!;
  const before = { ...s.pos };
  movementSystem(w);
  expect(Math.hypot(s.pos.x - before.x, s.pos.y - before.y)).toBeCloseTo(SURVIVOR_WALK_SPEED, 5);
});

test('atacar: todos a por el zombi; cuando muere, se quedan donde están', () => {
  const w = world();
  const a = w.survivors[0]!;
  const b = addSurvivor(w, { x: 11, y: 10 });
  const z = newZombie(w, { x: 20, y: 10 });
  w.zombies.push(z);
  draft(w, [a, b]);
  issue(w, { type: 'draftAttack', survivorIds: [a.id, b.id], zombieId: z.id });
  ordersSystem(w);
  for (const s of [a, b]) expect(s.action).toMatchObject({ type: 'melee', zombieId: z.id });
  w.zombies = [];
  combatSystem(w);
  decisionsSystem(w);
  for (const s of [a, b]) {
    expect(s.action.type).toBe('idle');
    expect(s.drafted).toBe(true);
  }
});

test('no huye, no come, no trabaja ni se va a dormir por su cuenta', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'flee';
  s.needs.hunger = 5;
  s.needs.sleep = 10;
  w.zombies.push(newZombie(w, { x: 14, y: 10 })); // a la vista, a 4 casillas
  draft(w, [s]);
  for (let i = 0; i < 20; i++) {
    decisionsSystem(w);
    w.tick++;
  }
  expect(s.action.type).toBe('idle');
  expect(tileOf(s.pos)).toEqual({ x: 10, y: 10 });
});

test('si un zombi le toca, le golpea sin moverse; si se aleja, no lo persigue', () => {
  const w = world();
  const s = w.survivors[0]!;
  const z = newZombie(w, { x: 11, y: 10 });
  w.zombies.push(z);
  draft(w, [s]);
  decisionsSystem(w);
  expect(s.action).toMatchObject({ type: 'melee', zombieId: z.id, hold: true });
  combatSystem(w);
  expect(tileOf(s.pos)).toEqual({ x: 10, y: 10 });
  z.pos = { x: 16.5, y: 10.5 };
  combatSystem(w);
  expect(s.action.type).toBe('idle');
  expect(tileOf(s.pos)).toEqual({ x: 10, y: 10 });
});

test('sale del modo combate al caer derribado, al desplomarse de sueño o en crisis', () => {
  const w = world();
  const [a, b, c] = [
    w.survivors[0]!,
    addSurvivor(w, { x: 12, y: 10 }),
    addSurvivor(w, { x: 14, y: 10 }),
  ];
  draft(w, [a, b, c]);
  hurtSurvivor(w, a, 200);
  expect(a.drafted).toBe(false);
  b.needs.sleep = 0;
  c.needs.mood = MOOD_CRISIS - 5;
  decisionsSystem(w);
  expect(b.drafted).toBe(false);
  expect(b.action.type).toBe('sleep');
  expect(c.drafted).toBe(false);
  expect(c.action).toMatchObject({ type: 'moveTo', then: { type: 'crisis' } });
  expect(checkInvariants(w)).toEqual([]);
});

test('en modo combate nadie le consuela ni se pelea con él', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.needs.mood = 15;
  expect(isAvailable(s)).toBe(true);
  expect(needsConsoling(s, w)).toBe(true);
  draft(w, [s]);
  expect(isAvailable(s)).toBe(false);
  expect(needsConsoling(s, w)).toBe(false);
});

test('invariante: nadie derribado ni durmiendo en modo combate', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.drafted = true;
  expect(checkInvariants(w)).toEqual([]);
  s.action = { type: 'sleep', inBed: false };
  expect(checkInvariants(w).join()).toMatch(/modo combate/);
});
