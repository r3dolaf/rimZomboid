import { expect, test } from 'vitest';
import { contains, expand, intersects } from './geom';

const r = { x: 2, y: 3, w: 4, h: 2 }; // casillas x 2..5, y 3..4

test('contains incluye los bordes del rectángulo', () => {
  expect(contains(r, { x: 2, y: 3 })).toBe(true);
  expect(contains(r, { x: 5, y: 4 })).toBe(true);
  expect(contains(r, { x: 6, y: 4 })).toBe(false);
  expect(contains(r, { x: 2, y: 5 })).toBe(false);
});

test('intersects detecta solape y no contacto', () => {
  expect(intersects(r, { x: 5, y: 4, w: 3, h: 3 })).toBe(true);
  expect(intersects(r, { x: 6, y: 3, w: 2, h: 2 })).toBe(false);
});

test('expand agranda por todos los lados', () => {
  expect(expand(r, 2)).toEqual({ x: 0, y: 1, w: 8, h: 6 });
});
