// B2: las crisis (encerrarse, atracón, rabia y huida), sus pesos con los rasgos y la inspiración.
import { expect, test } from 'vitest';
import {
  BINGE_FOOD,
  CRISIS_HOURS,
  FLEE_DIST,
  INSPIRED_SPEED,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { dayStart } from './clock';
import { contains } from './geom';
import { chooseCrisis, crisisAction, inspirationSystem } from './crisis';
import { checkInvariants } from './invariants';
import { findPath } from './path/astar';
import { createRng } from './rng';
import { workSpeed } from './skills';
import { step } from './step';
import { withoutZombies } from './testing/fixtures';
import type { CrisisKind, Survivor, World } from './types';
import { createWorld, tileOf } from './world';

/** Una partida sin zombis con la primera persona hundida (y los demás, fuera de juego). */
function sad(seed = 3): { w: World; s: Survivor } {
  const w = withoutZombies(createWorld(seed));
  const s = w.survivors[0]!;
  s.needs.mood = 0;
  s.needs.hunger = 100;
  s.needs.thirst = 100;
  s.needs.sleep = 100;
  for (const o of w.survivors.slice(1)) o.needs.mood = 100;
  return { w, s };
}

/** Le manda esa crisis y avanza hasta que la empieza (o se acaba la paciencia). */
function start(w: World, s: Survivor, kind: CrisisKind): void {
  s.action = crisisAction(s, w, kind);
  if (s.action.type === 'moveTo') s.path = findPath(w.grid, tileOf(s.pos), s.action.target) ?? [];
  for (let i = 0; i < 3000 && s.action.type !== 'crisis'; i++) step(w);
}

const share = (kind: CrisisKind, s: Survivor, w: World, n = 400) => {
  w.rng = createRng(11);
  let k = 0;
  for (let i = 0; i < n; i++) if (chooseCrisis(s, w) === kind) k++;
  return k / n;
};

test('los pesos: Glotón, más atracones; Desagradable, más rabia; Cobarde, más huidas; Valiente, ninguna', () => {
  const { w, s } = sad();
  s.traits = [];
  const binge = share('binge', s, w);
  const rage = share('rage', s, w);
  const flee = share('flee', s, w);
  expect(binge).toBeGreaterThan(0.1);
  expect(rage).toBeGreaterThan(0.1);
  expect(flee).toBeGreaterThan(0.1);
  s.traits = ['glutton'];
  expect(share('binge', s, w)).toBeGreaterThan(binge + 0.15);
  s.traits = ['unpleasant'];
  expect(share('rage', s, w)).toBeGreaterThan(rage + 0.1);
  s.traits = ['coward'];
  expect(share('flee', s, w)).toBeGreaterThan(flee + 0.15);
  s.traits = ['brave'];
  expect(share('flee', s, w)).toBe(0);
  s.traits = [];
  w.storage.items.food = 0;
  w.storage.items.potato = 0;
  w.storage.items.stewVeg = 0;
  expect(share('binge', s, w)).toBe(0);
});

test('encerrarse: en la base, 2 h, y al acabar se desahoga', () => {
  const { w, s } = sad();
  start(w, s, 'sulk');
  expect(s.action).toMatchObject({ type: 'crisis', kind: 'sulk' });
  expect(contains(w.base.rect, tileOf(s.pos))).toBe(true);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'crisis', crisis: 'sulk' });
  for (let i = 0; i < CRISIS_HOURS.sulk * TICKS_PER_HOUR + 5; i++) step(w);
  expect(s.memories.some((m) => m.id === 'vented')).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('atracón: en el almacén se come de golpe hasta 3 raciones', () => {
  const { w, s } = sad();
  w.storage.items.food = 10;
  start(w, s, 'binge');
  expect(s.action).toMatchObject({ type: 'crisis', kind: 'binge' });
  expect(w.storage.items.food).toBe(10 - BINGE_FOOD);
  expect(w.common.log.find((e) => e.kind === 'crisis')).toMatchObject({
    crisis: 'binge',
    food: BINGE_FOOD,
  });
});

test('rabia: golpea una puerta o una ventana de la base (la daña o la rompe, y se oye)', () => {
  const { w, s } = sad();
  start(w, s, 'rage');
  expect(s.action).toMatchObject({ type: 'crisis', kind: 'rage' });
  const a = s.action as { tile: number };
  const [x, y] = [a.tile % w.grid.width, Math.floor(a.tile / w.grid.width)];
  expect(contains(w.base.rect, { x, y })).toBe(true);
  const before = w.grid.tiles[a.tile];
  for (let i = 0; i < CRISIS_HOURS.rage * TICKS_PER_HOUR; i++) step(w);
  const damaged = w.damage[String(a.tile)] !== undefined || w.grid.tiles[a.tile] !== before;
  expect(damaged).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('huida: se va lejos de la base y se queda allí', () => {
  const { w, s } = sad();
  start(w, s, 'flee');
  expect(s.action).toMatchObject({ type: 'crisis', kind: 'flee' });
  const r = w.base.rect;
  const d = Math.hypot(s.pos.x - (r.x + r.w / 2), s.pos.y - (r.y + r.h / 2));
  expect(d).toBeGreaterThanOrEqual(FLEE_DIST[0] - 2);
  expect(contains(r, tileOf(s.pos))).toBe(false);
  expect(w.common.log.find((e) => e.kind === 'crisis')).toMatchObject({ crisis: 'flee' });
});

test('una partida de antes: la crisis sin tipo es la de siempre', () => {
  const { w, s } = sad();
  s.action = { type: 'crisis', ticksLeft: 5 };
  for (let i = 0; i < 6; i++) step(w);
  expect(s.memories.some((m) => m.id === 'vented')).toBe(true);
});

test('inspiración: a las 9, con el ánimo alto, a veces; un día trabajando un 50 % más rápido', () => {
  const w = withoutZombies(createWorld(5));
  const s = w.survivors[0]!;
  const speed = workSpeed(s, 'build');
  let inspired = 0;
  for (let d = 2; d < 60; d++) {
    for (const o of w.survivors) o.needs.mood = 95;
    w.tick = dayStart(d) + 9 * TICKS_PER_HOUR;
    inspirationSystem(w);
    if (s.inspiredUntil !== undefined && s.inspiredUntil === w.tick + TICKS_PER_DAY) inspired++;
    const was = s.inspiredUntil;
    w.tick += TICKS_PER_DAY - 1;
    inspirationSystem(w); // aún un tick antes de acabar
    expect(s.inspiredUntil).toBe(was);
    w.tick += 2; // pasada la hora (y no a las 9 en punto: ahí se sortea otra)
    inspirationSystem(w);
    expect(s.inspiredUntil).toBeUndefined();
  }
  expect(inspired).toBeGreaterThan(2);
  expect(inspired).toBeLessThan(20);
  s.inspiredUntil = w.tick + 100;
  expect(workSpeed(s, 'build')).toBeCloseTo(speed * INSPIRED_SPEED);
  // Con el ánimo bajo, nunca.
  delete s.inspiredUntil;
  for (let d = 60; d < 100; d++) {
    s.needs.mood = 50;
    w.tick = dayStart(d) + 9 * TICKS_PER_HOUR;
    inspirationSystem(w);
    expect(s.inspiredUntil).toBeUndefined();
  }
});
