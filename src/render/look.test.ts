// A1: lo que decide cómo se ve cada casilla del mapa (muros de alrededor, calles y variantes).
import { describe, expect, test } from 'vitest';
import { createGrid, setTile } from '../sim/map/grid';
import { Tile, type Grid } from '../sim/types';
import { hash2, isWallLike, laneAt, lookTile, tileLook, wallSides } from './look';

/** Pinta un rectángulo de casillas. */
function fill(g: Grid, x0: number, y0: number, w: number, h: number, t: Tile): Grid {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setTile(g, x, y, t);
  return g;
}

test('muros, puertas y ventanas se dibujan como muro; el suelo, la carretera, los árboles y los cascotes, no', () => {
  for (const t of [
    Tile.Wall,
    Tile.WoodWall,
    Tile.Door,
    Tile.LockedDoor,
    Tile.BrokenDoor,
    Tile.Window,
    Tile.BoardedWindow,
    Tile.BrokenWindow,
    Tile.CurtainedWindow,
  ])
    expect(isWallLike(t)).toBe(true);
  for (const t of [Tile.Grass, Tile.Floor, Tile.Road, Tile.Tree, Tile.Rubble])
    expect(isWallLike(t)).toBe(false);
});

test('fuera del mapa no hay muros: el borde no da sombra ni corta la cara de un muro', () => {
  const g = fill(createGrid(3, 3, Tile.Grass), 0, 2, 3, 1, Tile.Wall);
  expect(wallSides(g, 1, 2)).toEqual({ n: false, s: false, e: true, w: true });
  expect(wallSides(g, 0, 2).w).toBe(false);
});

describe('la raya del centro de las calles', () => {
  test('en una calle de 2 que va de lado a lado, entre las dos filas', () => {
    const g = fill(createGrid(10, 6, Tile.Grass), 0, 2, 10, 2, Tile.Road);
    expect(laneAt(g, 5, 2)).toEqual({ dir: 'h', at: [15] });
    expect(laneAt(g, 5, 3)).toEqual({ dir: 'h', at: [0] });
  });

  test('en una de 3, en medio de la fila del centro', () => {
    const g = fill(createGrid(10, 6, Tile.Grass), 0, 1, 10, 3, Tile.Road);
    expect(laneAt(g, 5, 2)).toEqual({ dir: 'h', at: [7, 8] });
    expect(laneAt(g, 5, 1)).toBeNull();
    expect(laneAt(g, 5, 3)).toBeNull();
  });

  test('en una que va de arriba abajo, en vertical; en el cruce y fuera de la carretera, ninguna', () => {
    const g = fill(createGrid(10, 10, Tile.Grass), 0, 2, 10, 2, Tile.Road);
    fill(g, 4, 0, 2, 10, Tile.Road);
    expect(laneAt(g, 4, 7)).toEqual({ dir: 'v', at: [15] });
    expect(laneAt(g, 5, 7)).toEqual({ dir: 'v', at: [0] });
    expect(laneAt(g, 1, 2)).toEqual({ dir: 'h', at: [15] });
    expect(laneAt(g, 4, 2)).toBeNull();
    expect(laneAt(g, 5, 3)).toBeNull();
    expect(laneAt(g, 0, 0)).toBeNull();
  });

  test('un trozo de carretera de 3 o menos de largo no lleva raya', () => {
    const g = fill(createGrid(10, 6, Tile.Grass), 2, 2, 3, 2, Tile.Road);
    expect(laneAt(g, 3, 2)).toBeNull();
  });
});

describe('cuándo se repinta una casilla', () => {
  test('cambia si se levanta un muro al lado (su sombra), no si se levanta más lejos', () => {
    const g = createGrid(6, 6, Tile.Floor);
    const i = 3 * 6 + 3;
    const before = tileLook(g, i, false);
    setTile(g, 3, 1, Tile.WoodWall);
    expect(tileLook(g, i, false)).toBe(before);
    setTile(g, 3, 2, Tile.WoodWall);
    expect(tileLook(g, i, false)).not.toBe(before);
  });

  test('cada tipo de casilla cabe en los 4 bits de abajo', () => {
    expect(Math.max(...Object.values(Tile))).toBeLessThan(16);
  });

  test('cambia con las cortinas y con lo que hay en la casilla, que se puede leer de vuelta', () => {
    const g = createGrid(3, 3, Tile.Window);
    expect(tileLook(g, 4, true)).not.toBe(tileLook(g, 4, false));
    expect(lookTile(tileLook(g, 4, true))).toBe(Tile.Window);
    setTile(g, 1, 1, Tile.BoardedWindow);
    expect(lookTile(tileLook(g, 4, false))).toBe(Tile.BoardedWindow);
  });

  test('en la carretera cambia con el arcén y con la raya', () => {
    const g = fill(createGrid(10, 6, Tile.Grass), 0, 2, 10, 2, Tile.Road);
    const top = tileLook(g, 2 * 10 + 5, false);
    const bottom = tileLook(g, 3 * 10 + 5, false);
    expect(top).not.toBe(bottom);
    expect(lookTile(top)).toBe(Tile.Road);
  });
});

test('cada casilla tiene su número fijo, y en un trozo pequeño salen todas las variantes', () => {
  expect(hash2(12, 34)).toBe(hash2(12, 34));
  expect(hash2(12, 34)).not.toBe(hash2(34, 12));
  const seen = new Set<number>();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) seen.add(hash2(x, y) % 8);
  expect(seen.size).toBe(8);
});
