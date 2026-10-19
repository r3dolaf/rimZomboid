import { expect, test } from 'vitest';
import { contains } from './geom';
import { checkInvariants } from './invariants';
import { getTile } from './map/grid';
import { Tile } from './types';
import { createWorld, tileOf } from './world';

test('crea 3 supervivientes en casillas Floor distintas dentro de la base', () => {
  const w = createWorld(10);
  expect(w.survivors).toHaveLength(3);
  const tiles = w.survivors.map((s) => tileOf(s.pos));
  expect(new Set(tiles.map((t) => `${t.x},${t.y}`)).size).toBe(3);
  for (const t of tiles) {
    expect(getTile(w.grid, t.x, t.y)).toBe(Tile.Floor);
    expect(contains(w.base.rect, t)).toBe(true);
  }
});

test('los supervivientes empiezan en el centro de su casilla', () => {
  for (const s of createWorld(10).survivors) {
    expect(s.pos.x % 1).toBeCloseTo(0.5);
    expect(s.pos.y % 1).toBeCloseTo(0.5);
  }
});

test('nombres e ids distintos', () => {
  const ss = createWorld(10).survivors;
  expect(new Set(ss.map((s) => s.name)).size).toBe(3);
  expect(new Set(ss.map((s) => s.id)).size).toBe(3);
});

test('guarda la semilla y empieza en el tick 0', () => {
  const w = createWorld(10);
  expect(w.seed).toBe(10);
  expect(w.tick).toBe(0);
});

test('el mundo sobrevive a JSON', () => {
  const w = createWorld(10);
  expect(JSON.parse(JSON.stringify(w))).toEqual(w);
});

test('mundo recién creado sin problemas, para 20 semillas', () => {
  for (let s = 1; s <= 20; s++) expect(checkInvariants(createWorld(s))).toEqual([]);
});

test('tileOf redondea hacia abajo', () => {
  expect(tileOf({ x: 3.99, y: 0.01 })).toEqual({ x: 3, y: 0 });
});
