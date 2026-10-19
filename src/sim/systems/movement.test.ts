import { expect, test } from 'vitest';
import { IDLE_TICKS_MAX, IDLE_TICKS_MIN, SURVIVOR_WALK_SPEED } from '../balance';
import { emptyWorld } from '../testing/fixtures';
import type { Action } from '../types';
import { tileOf } from '../world';
import { movementSystem } from './movement';

test('avanza SURVIVOR_WALK_SPEED casillas por tick hacia la siguiente casilla', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 3, y: 0 } };
  s.path = [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ];
  movementSystem(w);
  expect(s.pos.x).toBeCloseTo(0.5 + SURVIVOR_WALK_SPEED);
  expect(s.pos.y).toBeCloseTo(0.5);
});

test('en diagonal recorre la misma distancia por tick', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 1, y: 1 } };
  s.path = [{ x: 1, y: 1 }];
  movementSystem(w);
  expect(Math.hypot(s.pos.x - 0.5, s.pos.y - 0.5)).toBeCloseTo(SURVIVOR_WALK_SPEED);
});

test('al llegar al destino pasa a idle entre IDLE_TICKS_MIN y IDLE_TICKS_MAX', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 1, y: 0 } };
  s.path = [{ x: 1, y: 0 }];
  for (let i = 0; i < 20; i++) movementSystem(w);
  expect(tileOf(s.pos)).toEqual({ x: 1, y: 0 });
  expect(s.pos).toEqual({ x: 1.5, y: 0.5 });
  const a = s.action as Action; // TS no sabe que movementSystem la ha cambiado
  expect(a.type).toBe('idle');
  if (a.type === 'idle') {
    expect(a.ticksLeft).toBeGreaterThanOrEqual(IDLE_TICKS_MIN);
    expect(a.ticksLeft).toBeLessThanOrEqual(IDLE_TICKS_MAX);
  }
});

test('un superviviente quieto no se mueve', () => {
  const w = emptyWorld(10, 10);
  movementSystem(w);
  expect(w.survivors[0]!.pos).toEqual({ x: 0.5, y: 0.5 });
});
