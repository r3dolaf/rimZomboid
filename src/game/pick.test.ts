import { expect, test } from 'vitest';
import { createWorld } from '../sim/world';
import { containerAt, houseAt, survivorAt } from './pick';

test('encuentra al superviviente más cercano dentro del radio', () => {
  const w = createWorld(2);
  const s = w.survivors[1]!;
  expect(survivorAt(w, s.pos.x + 0.3, s.pos.y - 0.2, 0.6)?.id).toBe(s.id);
});

test('fuera del radio no encuentra a nadie', () => {
  const w = createWorld(2);
  expect(survivorAt(w, 0, 0, 0.6)).toBeNull();
});

test('houseAt devuelve la casa que contiene la casilla, muros incluidos', () => {
  const w = createWorld(2);
  const h = w.houses[1]!;
  expect(houseAt(w, h.rect.x, h.rect.y)?.id).toBe(h.id);
  expect(houseAt(w, h.rect.x + 1, h.rect.y + 1)?.id).toBe(h.id);
  expect(houseAt(w, w.base.rect.x + 1, w.base.rect.y + 1)).toBeNull(); // la base no es una casa
  expect(houseAt(w, 0, 0)).toBeNull();
});

test('containerAt devuelve el contenedor de esa casilla', () => {
  const w = createWorld(2);
  const c = w.containers[2]!;
  expect(containerAt(w, c.pos.x, c.pos.y)?.id).toBe(c.id);
  expect(containerAt(w, 0, 0)).toBeNull();
});

test('containerAt: si un cuerpo cayó en la casilla de un mueble, el cuerpo va encima (H4d)', () => {
  const w = createWorld(2);
  const c = w.containers[2]!;
  const corpse = { ...structuredClone(c), id: 999, houseId: -1, kind: 'corpse' as const };
  w.containers.push(corpse);
  expect(containerAt(w, c.pos.x, c.pos.y)?.id).toBe(999);
});
