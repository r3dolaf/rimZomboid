// H4b §2.2 y §3: línea de visión, ruido y la hoguera de noche.
import { expect, test } from 'vitest';
import {
  BUILD,
  CHOP_NOISE_TICKS,
  NOISE,
  RUN_NOISE_TICKS,
  START_HOUR,
  SURVIVOR_RUN_SPEED,
  SURVIVOR_WALK_SPEED,
  TICKS_PER_HOUR,
} from '../balance';
import { workOnBlueprint } from '../jobs/build';
import { setTile } from '../map/grid';
import { damageTile } from '../structures';
import { activitiesSystem } from '../systems/activities';
import { movementSystem } from '../systems/movement';
import { emptyWorld } from '../testing/fixtures';
import { Tile, type World } from '../types';
import { lineOfSight } from '../vision';
import { makeNoise, visibleCampfire } from '../noise';
import { newZombie } from './spawn';

function world(w = 30, h = 30): World {
  const out = emptyWorld(w, h);
  out.seen.fill(1);
  return out;
}

const zombieAt = (w: World, x: number, y: number) => {
  const z = newZombie(w, { x, y });
  w.zombies.push(z);
  return z;
};

test('línea de visión: la tapan muros, árboles, puertas y tablas; las ventanas y lo roto, no', () => {
  const w = world(10, 3);
  const see = () => lineOfSight(w.grid, { x: 0, y: 1 }, { x: 9, y: 1 });
  expect(see()).toBe(true);
  for (const t of [Tile.Wall, Tile.Tree, Tile.Door, Tile.BoardedWindow, Tile.WoodWall]) {
    setTile(w.grid, 5, 1, t);
    expect(see(), `casilla ${t}`).toBe(false);
  }
  for (const t of [Tile.Window, Tile.BrokenWindow, Tile.BrokenDoor, Tile.Rubble]) {
    setTile(w.grid, 5, 1, t);
    expect(see(), `casilla ${t}`).toBe(true);
  }
  // Hueco en diagonal entre dos muros: no se ve a través.
  const d = world(5, 5);
  setTile(d.grid, 2, 1, Tile.Wall);
  setTile(d.grid, 1, 2, Tile.Wall);
  expect(lineOfSight(d.grid, { x: 1, y: 1 }, { x: 3, y: 3 })).toBe(false);
  expect(lineOfSight(d.grid, { x: 3, y: 1 }, { x: 3, y: 3 })).toBe(true);
});

test('ruido: alerta a los zombis del radio hacia el origen, sin mirar muros; los que persiguen siguen', () => {
  const w = world();
  const near = zombieAt(w, 10, 5);
  const far = zombieAt(w, 10, 20);
  const chasing = zombieAt(w, 12, 5);
  chasing.state = 'chase';
  chasing.targetId = 1;
  for (let y = 0; y < 30; y++) setTile(w.grid, 8, y, Tile.Wall);
  makeNoise(w, { x: 5.5, y: 5.5 }, 8);
  expect(near).toMatchObject({ state: 'alert', goal: { x: 5, y: 5 } });
  expect(far.state).toBe('wander');
  expect(chasing).toMatchObject({ state: 'chase', targetId: 1 });
});

test('talar hace ruido de radio 8 cada CHOP_NOISE_TICKS', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  setTile(w.grid, 6, 5, Tile.Tree);
  const inside = zombieAt(w, 5, 5 + NOISE.chop - 1);
  const outside = zombieAt(w, 5, 5 + NOISE.chop + 2);
  s.action = { type: 'chop', tree: 5 * 30 + 6, ticksLeft: 10 * CHOP_NOISE_TICKS };
  for (let i = 0; i < CHOP_NOISE_TICKS; i++) activitiesSystem(w);
  expect(inside.state).toBe('alert');
  expect(outside.state).toBe('wander');
});

test('construir hace ruido de radio 6', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 6.5 };
  w.blueprints.push({ id: 7, kind: 'table', pos: { x: 5, y: 5 }, wood: 4, progress: 0 });
  w.common.woodLog.start = 4;
  const inside = zombieAt(w, 5, 5 + NOISE.build - 1);
  const outside = zombieAt(w, 5, 5 + NOISE.build + 2);
  for (let i = 0; i < BUILD.table.ticks / 2; i++) workOnBlueprint(w, s, 7);
  expect(inside.state).toBe('alert');
  expect(outside.state).toBe('wander');
});

test('correr va más rápido que andar y hace ruido de radio 5; andar, ninguno', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 15.5 };
  s.path = Array.from({ length: 20 }, (_, i) => ({ x: 2 + i, y: 15 }));
  s.action = { type: 'moveTo', target: { x: 21, y: 15 } };
  const z = zombieAt(w, 1, 15 + NOISE.run - 1);
  for (let i = 0; i < RUN_NOISE_TICKS; i++) movementSystem(w);
  const walked = s.pos.x - 1.5;
  expect(walked).toBeCloseTo(RUN_NOISE_TICKS * SURVIVOR_WALK_SPEED, 0); // (al pasar por cada centro pierde un poco)
  expect(z.state).toBe('wander');
  s.action = { type: 'moveTo', target: { x: 21, y: 15 }, run: true };
  const x0 = s.pos.x;
  for (let i = 0; i < RUN_NOISE_TICKS; i++) movementSystem(w);
  expect(s.pos.x - x0).toBeCloseTo(RUN_NOISE_TICKS * SURVIVOR_RUN_SPEED, 0);
  expect(s.pos.x - x0).toBeGreaterThan(walked * 1.4);
  expect(z.state).toBe('alert');
});

test('romperse algo hace ruido de radio 12', () => {
  const w = world();
  setTile(w.grid, 5, 5, Tile.Window);
  const inside = zombieAt(w, 5, 5 + NOISE.broken - 1);
  const outside = zombieAt(w, 5, 5 + NOISE.broken + 2);
  damageTile(w, 5, 5, 1000);
  expect(inside.state).toBe('alert');
  expect(outside.state).toBe('wander');
});

test('la hoguera se ve de noche a 15 casillas en línea recta', () => {
  const w = world();
  w.furniture.push({ id: 3, kind: 'campfire', pos: { x: 5, y: 5 } });
  const z = zombieAt(w, 5, 18);
  const night = (24 - START_HOUR) * TICKS_PER_HOUR; // medianoche del día 1
  w.tick = night;
  expect(visibleCampfire(w, z)).toEqual({ x: 5, y: 5 });
  w.tick = 0; // 08:00, de día
  expect(visibleCampfire(w, z)).toBeNull();
  w.tick = night;
  setTile(w.grid, 5, 10, Tile.Wall);
  expect(visibleCampfire(w, z)).toBeNull();
  setTile(w.grid, 5, 10, Tile.Grass);
  z.pos = { x: 5.5, y: 25.5 };
  expect(visibleCampfire(w, z)).toBeNull();
});
