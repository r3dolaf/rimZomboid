import { expect, test } from 'vitest';
import { Tile } from '../types';
import { createGrid, getTile, inBounds, isWalkable, setTile } from './grid';

test('una cuadrícula nueva está llena del tipo indicado', () => {
  const g = createGrid(4, 3, Tile.Grass);
  expect(g.tiles).toHaveLength(12);
  expect(getTile(g, 3, 2)).toBe(Tile.Grass);
});

test('setTile y getTile usan (x, y)', () => {
  const g = createGrid(4, 3, Tile.Grass);
  setTile(g, 1, 2, Tile.Wall);
  expect(getTile(g, 1, 2)).toBe(Tile.Wall);
  expect(getTile(g, 2, 1)).toBe(Tile.Grass);
});

test('fuera de los límites se comporta como muro', () => {
  const g = createGrid(4, 3, Tile.Grass);
  expect(inBounds(g, -1, 0)).toBe(false);
  expect(inBounds(g, 3, 2)).toBe(true);
  expect(getTile(g, -1, 0)).toBe(Tile.Wall);
  expect(isWalkable(g, 4, 0)).toBe(false);
});

test('setTile fuera de los límites lanza error', () => {
  expect(() => setTile(createGrid(2, 2, Tile.Grass), 2, 0, Tile.Wall)).toThrow();
});

test.each([
  [Tile.Grass, true],
  [Tile.Floor, true],
  [Tile.Road, true],
  [Tile.Door, true],
  [Tile.Wall, false],
  [Tile.Window, false],
  [Tile.Tree, false],
])('transitabilidad de la casilla %i = %s', (t, esperado) => {
  const g = createGrid(1, 1, t);
  expect(isWalkable(g, 0, 0)).toBe(esperado);
});
