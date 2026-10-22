import { expect, test } from 'vitest';
import { createWorld } from '../sim/world';
import { containerAt, houseAt, survivorAt, tableAt } from './pick';

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

test('tableAt: la mesa vista de esa casilla, para abrir Fabricar con un clic (H4d)', () => {
  const w = createWorld(2);
  const p = { x: w.base.rect.x + 2, y: w.base.rect.y + 2 };
  w.furniture.push({ id: 700, kind: 'table', pos: p });
  w.furniture.push({ id: 701, kind: 'campfire', pos: { x: p.x + 1, y: p.y } });
  w.seen[p.y * w.grid.width + p.x] = 1;
  w.seen[p.y * w.grid.width + p.x + 1] = 1;
  expect(tableAt(w, p.x, p.y)?.id).toBe(700);
  expect(tableAt(w, p.x + 1, p.y)).toBeNull(); // una hoguera no
  w.seen[p.y * w.grid.width + p.x] = 0;
  expect(tableAt(w, p.x, p.y)).toBeNull();
});
