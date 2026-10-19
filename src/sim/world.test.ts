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

test('3 camas sobre suelo de la base, cada una con su dueño', () => {
  const w = createWorld(10);
  expect(w.beds).toHaveLength(3);
  const r = w.base.rect;
  expect(w.beds.map((b) => b.pos)).toEqual([
    { x: r.x + 2, y: r.y + 1 },
    { x: r.x + 5, y: r.y + 1 },
    { x: r.x + 9, y: r.y + 1 },
  ]);
  w.survivors.forEach((s, i) => {
    expect(w.beds[i]!.ownerId).toBe(s.id);
    expect(s.bedId).toBe(w.beds[i]!.id);
  });
  for (const b of w.beds) expect(getTile(w.grid, b.pos.x, b.pos.y)).toBe(Tile.Floor);
});

test('almacén de 2 casillas junto a la puerta, con 35 latas', () => {
  const w = createWorld(10);
  const r = w.base.rect;
  expect(w.storage.tiles).toEqual([
    { x: r.x + 7, y: r.y + r.h - 2 },
    { x: r.x + 8, y: r.y + r.h - 2 },
  ]);
  for (const t of w.storage.tiles) expect(getTile(w.grid, t.x, t.y)).toBe(Tile.Floor);
  expect(w.storage.food).toBe(35);
});

test('necesidades iniciales entre 60 y 100, sin recuerdos y con 1–2 rasgos', () => {
  for (let seed = 1; seed <= 20; seed++)
    for (const s of createWorld(seed).survivors) {
      expect(s.needs.hunger).toBeGreaterThanOrEqual(60);
      expect(s.needs.hunger).toBeLessThanOrEqual(100);
      expect(s.needs.sleep).toBeGreaterThanOrEqual(60);
      expect(s.needs.sleep).toBeLessThanOrEqual(100);
      expect(s.memories).toEqual([]);
      expect(s.traits.length).toBeGreaterThanOrEqual(1);
    }
});
