import { describe, expect, test } from 'vitest';
import { contains, intersects } from '../geom';
import { findPath } from '../path/astar';
import { createRng } from '../rng';
import { Tile, type Rect } from '../types';
import { generateMap } from './generate';
import { getTile } from './grid';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

/** Distancia de Chebyshev de una casilla a un rectángulo (0 si está dentro). */
function distToRect(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w - 1));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h - 1));
  return Math.max(dx, dy);
}

test('misma semilla, mismo mapa', () => {
  expect(generateMap(createRng(123))).toEqual(generateMap(createRng(123)));
});

test('semillas distintas, mapas distintos', () => {
  expect(generateMap(createRng(1)).houses).not.toEqual(generateMap(createRng(2)).houses);
});

describe.each(SEEDS)('semilla %i', (s) => {
  const m = generateMap(createRng(s));
  const all = [m.base, ...m.houses];

  test('unos 18–40 edificios (H4f)', () => {
    expect(m.houses.length).toBeGreaterThanOrEqual(18);
    expect(m.houses.length).toBeLessThanOrEqual(40);
  });

  test('todas las puertas son alcanzables desde la base', () => {
    for (const h of m.houses) expect(findPath(m.grid, m.base.door, h.door)).not.toBeNull();
  });

  test('los edificios no se solapan ni pisan carreteras', () => {
    for (const b of all) {
      for (let y = b.rect.y; y < b.rect.y + b.rect.h; y++)
        for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++)
          expect(getTile(m.grid, x, y)).not.toBe(Tile.Road);
      for (const o of all) if (o !== b) expect(intersects(b.rect, o.rect)).toBe(false);
    }
  });

  test('cada puerta es una casilla Door en el muro de su edificio', () => {
    for (const b of all) {
      expect(getTile(m.grid, b.door.x, b.door.y)).toBe(Tile.Door);
      expect(contains(b.rect, b.door)).toBe(true);
      expect(
        distToRect(
          { ...b.rect, x: b.rect.x + 1, y: b.rect.y + 1, w: b.rect.w - 2, h: b.rect.h - 2 },
          b.door.x,
          b.door.y,
        ),
      ).toBe(1);
    }
  });

  test('ningún árbol a 2 casillas o menos de un edificio', () => {
    for (let y = 0; y < m.grid.height; y++)
      for (let x = 0; x < m.grid.width; x++)
        if (getTile(m.grid, x, y) === Tile.Tree)
          for (const b of all) expect(distToRect(b.rect, x, y)).toBeGreaterThan(2);
  });
});

test('los edificios tienen ventanas', () => {
  const m = generateMap(createRng(5));
  expect(m.grid.tiles.filter((t) => t === Tile.Window).length).toBeGreaterThan(m.houses.length);
});
