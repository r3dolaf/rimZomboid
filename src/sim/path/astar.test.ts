import { expect, test } from 'vitest';
import { createGrid, isWalkable, setTile } from '../map/grid';
import { Tile, type Grid } from '../types';
import { findPath, invalidateRegions, regionOf } from './astar';

/** Mapa en texto: '.' hierba, '#' muro. */
function grid(...rows: string[]): Grid {
  const g = createGrid(rows[0]!.length, rows.length, Tile.Grass);
  rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && setTile(g, x, y, Tile.Wall)));
  return g;
}

test('camino recto', () => {
  expect(findPath(grid('.....'), { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
  ]);
});

test('misma casilla devuelve camino vacío', () => {
  expect(findPath(grid('...'), { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
});

test('rodea un muro', () => {
  const g = grid('.#.', '.#.', '...');
  const p = findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })!;
  expect(p.at(-1)).toEqual({ x: 2, y: 0 });
  expect(p.every((c) => isWalkable(g, c.x, c.y))).toBe(true);
});

test('no corta esquinas en diagonal', () => {
  // de (0,0) a (1,1): la diagonal está prohibida porque (1,0) es muro
  expect(findPath(grid('.#', '..'), { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]);
});

test('destino encerrado devuelve null', () => {
  const g = grid('.....', '.###.', '.#.#.', '.###.', '.....');
  expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
});

test('destino no transitable devuelve null', () => {
  expect(findPath(grid('.#'), { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
});

test('cruza un mapa de 100x100 vacío en menos de 50 ms', () => {
  const g = createGrid(100, 100, Tile.Grass);
  findPath(g, { x: 0, y: 0 }, { x: 5, y: 5 }); // calentar el JIT
  const t0 = performance.now();
  expect(findPath(g, { x: 0, y: 0 }, { x: 99, y: 99 })).toHaveLength(99);
  expect(performance.now() - t0).toBeLessThan(50);
});

test('el camino es de coste mínimo en un laberinto', () => {
  const g = grid('.#...', '.#.#.', '...#.');
  // único camino: bajar, cruzar, subir por el centro y bajar a la derecha (10 pasos)
  const p = findPath(g, { x: 0, y: 0 }, { x: 4, y: 2 })!;
  expect(p.at(-1)).toEqual({ x: 4, y: 2 });
  expect(p).toHaveLength(10);
});

test('regiones: casillas conectadas comparten región y las aisladas no', () => {
  const g = grid('..#..', '..#..', '..#..');
  expect(regionOf(g, 0, 0)).toBe(regionOf(g, 1, 2));
  expect(regionOf(g, 0, 0)).not.toBe(regionOf(g, 4, 0));
  expect(regionOf(g, 2, 0)).toBe(-1); // muro
});

test('un destino encerrado en un mapa grande se descarta al momento', () => {
  const g = createGrid(100, 100, Tile.Grass);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (dx || dy) setTile(g, 90 + dx, 90 + dy, Tile.Wall);
  invalidateRegions(g);
  findPath(g, { x: 0, y: 0 }, { x: 5, y: 5 }); // calentar
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) expect(findPath(g, { x: 0, y: 0 }, { x: 90, y: 90 })).toBeNull();
  expect(performance.now() - t0).toBeLessThan(20); // 100 búsquedas
});

test('tras cambiar el mapa, invalidateRegions recalcula las regiones', () => {
  const g = grid('.#.');
  expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  setTile(g, 1, 0, Tile.Floor);
  invalidateRegions(g);
  expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(2);
});
