import { expect, test } from 'vitest';
import { checkInvariants } from './invariants';
import { createWorld } from './world';

test('detecta NaN (un solo problema)', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos.x = NaN;
  expect(checkInvariants(w)).toHaveLength(1);
});

test('detecta coordenadas infinitas', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos.y = Infinity;
  expect(checkInvariants(w)).toHaveLength(1);
});

test('detecta un superviviente dentro de un muro', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos = { x: w.base.rect.x + 0.5, y: w.base.rect.y + 0.5 };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta un superviviente fuera del mapa', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos = { x: -3, y: 10 };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta ids repetidos', () => {
  const w = createWorld(1);
  w.survivors[1]!.id = w.survivors[0]!.id;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta un tick no válido', () => {
  const w = createWorld(1);
  w.tick = -1;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  w.tick = 1.5;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});
