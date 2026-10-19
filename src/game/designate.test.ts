import { expect, test } from 'vitest';
import { houseMarked } from '../sim/orders';
import { step } from '../sim/step';
import { createWorld } from '../sim/world';
import { toggleContainer, toggleHouse } from './designate';

test('dos clics en pausa sobre la misma casa la dejan sin marcar', () => {
  const w = createWorld(3);
  const h = w.houses[0]!;
  toggleHouse(w, h.id);
  expect(houseMarked(w, h.id)).toBe(true); // ya se ve marcada, aunque la orden esté pendiente
  toggleHouse(w, h.id);
  expect(houseMarked(w, h.id)).toBe(false);
  step(w);
  expect(w.containers.some((c) => c.houseId === h.id && c.designated)).toBe(false);
});

test('un clic marca la casa al aplicarse la orden', () => {
  const w = createWorld(3);
  const h = w.houses[0]!;
  toggleHouse(w, h.id);
  step(w);
  expect(houseMarked(w, h.id)).toBe(true);
  expect(w.containers.filter((c) => c.houseId === h.id).every((c) => c.designated)).toBe(true);
});

test('alternar un contenedor también tiene en cuenta lo pendiente', () => {
  const w = createWorld(3);
  const c = w.containers[0]!;
  toggleContainer(w, c.id);
  toggleContainer(w, c.id);
  toggleContainer(w, c.id);
  step(w);
  expect(c.designated).toBe(true);
});
