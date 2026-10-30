// H5c2 §1: hexágonos con punta arriba en filas desplazadas (las impares, medio a la derecha).
import { expect, test } from 'vitest';
import { hexCenter, hexDistance, hexesWithin, hexIndex, hexOf, neighbors, sideFrom } from './hex';

const size = { width: 10, height: 8 };

test('índice y (columna, fila), y fuera del mapa', () => {
  expect(hexIndex(size, 3, 2)).toBe(23);
  expect(hexOf(size, 23)).toEqual({ col: 3, row: 2 });
  expect(hexIndex(size, -1, 0)).toBe(-1);
  expect(hexIndex(size, 10, 0)).toBe(-1);
  expect(hexIndex(size, 0, 8)).toBe(-1);
});

test('seis vecinos (menos en los bordes), según la fila sea par o impar', () => {
  const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
  // (4, 2), fila par: (5,2) (4,1) (3,1) (3,2) (3,3) (4,3)
  expect(sorted(neighbors(size, hexIndex(size, 4, 2)))).toEqual(
    sorted(
      [
        [5, 2],
        [4, 1],
        [3, 1],
        [3, 2],
        [3, 3],
        [4, 3],
      ].map(([c, r]) => hexIndex(size, c!, r!)),
    ),
  );
  // (4, 3), fila impar: (5,3) (5,2) (4,2) (3,3) (4,4) (5,4)
  expect(sorted(neighbors(size, hexIndex(size, 4, 3)))).toEqual(
    sorted(
      [
        [5, 3],
        [5, 2],
        [4, 2],
        [3, 3],
        [4, 4],
        [5, 4],
      ].map(([c, r]) => hexIndex(size, c!, r!)),
    ),
  );
  expect(neighbors(size, 0)).toHaveLength(2); // esquina
  for (const n of neighbors(size, hexIndex(size, 4, 3)))
    expect(hexDistance(size, n, hexIndex(size, 4, 3))).toBe(1);
});

test('distancia en hexágonos y los que quedan a radio r', () => {
  expect(hexDistance(size, hexIndex(size, 0, 0), hexIndex(size, 3, 0))).toBe(3);
  expect(hexDistance(size, hexIndex(size, 0, 0), hexIndex(size, 0, 2))).toBe(2);
  expect(hexDistance(size, hexIndex(size, 2, 2), hexIndex(size, 2, 2))).toBe(0);
  const big = { width: 20, height: 20 };
  const c = hexIndex(big, 10, 10);
  expect(hexesWithin(big, c, 0)).toEqual([c]);
  expect(hexesWithin(big, c, 1)).toHaveLength(7);
  expect(hexesWithin(big, c, 3)).toHaveLength(37);
  for (const i of hexesWithin(big, c, 3)) expect(hexDistance(big, c, i)).toBeLessThanOrEqual(3);
});

test('centro en el plano y hacia qué lado queda un hexágono de otro', () => {
  expect(hexCenter(size, hexIndex(size, 0, 0))).toEqual({ x: 0, y: 0 });
  const odd = hexCenter(size, hexIndex(size, 0, 1));
  expect(odd.x).toBeCloseTo(Math.sqrt(3) / 2);
  expect(odd.y).toBeCloseTo(1.5);
  const c = hexIndex(size, 4, 4);
  expect(sideFrom(size, c, hexIndex(size, 4, 1))).toBe(0); // norte
  expect(sideFrom(size, c, hexIndex(size, 4, 7))).toBe(1); // sur
  expect(sideFrom(size, c, hexIndex(size, 1, 4))).toBe(2); // oeste
  expect(sideFrom(size, c, hexIndex(size, 8, 4))).toBe(3); // este
  expect(sideFrom(size, c, hexIndex(size, 4, 3))).toBe(0); // vecino noreste: arriba
});
