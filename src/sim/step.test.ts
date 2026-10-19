import { expect, test } from 'vitest';
import { checkInvariants } from './invariants';
import { step } from './step';
import { createWorld } from './world';

test('step incrementa el tick', () => {
  const w = createWorld(1);
  step(w);
  expect(w.tick).toBe(1);
});

test('determinista: misma semilla, mismo mundo tras 2000 ticks', () => {
  const a = createWorld(77);
  const b = createWorld(77);
  for (let i = 0; i < 2000; i++) {
    step(a);
    step(b);
  }
  expect(a).toEqual(b);
});

test('tras 2000 ticks alguien se ha movido y no hay problemas', () => {
  const w = createWorld(77);
  const antes = w.survivors.map((s) => ({ ...s.pos }));
  for (let i = 0; i < 2000; i++) step(w);
  expect(w.survivors.some((s, i) => s.pos.x !== antes[i]!.x || s.pos.y !== antes[i]!.y)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('el mundo sigue siendo serializable tras avanzar', () => {
  const w = createWorld(5);
  for (let i = 0; i < 500; i++) step(w);
  expect(JSON.parse(JSON.stringify(w))).toEqual(w);
});
