import { expect, test } from 'vitest';
import { emptyInventory } from '../sim/items';
import { houseMarked } from '../sim/orders';
import { step } from '../sim/step';
import { createWorld } from '../sim/world';
import { markCorpsesIn, toggleContainer, toggleHouse } from './designate';

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

test('arrastrar con Saquear marca los cuerpos vistos del rectángulo que se pueden marcar (H4d)', () => {
  const w = createWorld(3);
  w.seen.fill(1);
  const base = w.containers[0]!;
  const corpse = (id: number, x: number, y: number) => {
    const c = { ...structuredClone(base), id, houseId: -1, kind: 'corpse' as const, pos: { x, y } };
    c.designated = false;
    c.searched = false;
    c.items = { ...emptyInventory(), cloth: 1 };
    w.containers.push(c);
    return c;
  };
  const a = corpse(901, 2, 2);
  const b = corpse(902, 4, 3);
  const hidden = corpse(903, 3, 3);
  w.seen[3 * w.grid.width + 3] = 0;
  const empty = corpse(904, 3, 2);
  empty.searched = true;
  empty.items = emptyInventory();
  const far = corpse(905, 9, 9);
  const marked = corpse(906, 2, 3);
  marked.designated = true;
  markCorpsesIn(w, { x: 4, y: 3 }, { x: 2, y: 2 });
  expect(w.orders).toEqual([
    { type: 'designateContainer', containerId: a.id, on: true },
    { type: 'designateContainer', containerId: b.id, on: true },
  ]);
  void hidden;
  void far;
  // Ni los muebles de las casas: arrastrar es solo para cuerpos.
  expect(w.orders.some((o) => o.type === 'designateContainer' && o.containerId === base.id)).toBe(
    false,
  );
});
