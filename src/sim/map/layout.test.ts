// H4f §2: el trazado del mapa — carreteras, pueblo, campo y dónde va cada edificio.
import { describe, expect, test } from 'vitest';
import { MAP_SIZE } from '../balance';
import { contains, expand, intersects } from '../geom';
import { createRng } from '../rng';
import { Tile, type Rect } from '../types';
import { getTile } from './grid';
import { planMap, type Lot } from './layout';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const SHOPS = ['supermarket', 'pharmacy', 'hardware', 'police', 'clothes'] as const;

/** Casillas entre el borde de `r` y el de `t` (0 si se tocan o se solapan). */
function gap(r: Rect, t: Rect): number {
  const dx = Math.max(t.x - (r.x + r.w), r.x - (t.x + t.w), 0);
  const dy = Math.max(t.y - (r.y + r.h), r.y - (t.y + t.h), 0);
  return Math.max(dx, dy);
}

/** ¿Hay carretera delante de la puerta, a `max` casillas o menos, en línea recta? */
function roadInFront(p: ReturnType<typeof planMap>, lot: Lot, max: number): boolean {
  const { x, y, w, h } = lot.rect;
  const [cx, cy] = [x + Math.floor(w / 2), y + Math.floor(h / 2)];
  const [sx, sy, dx, dy] =
    lot.side === 'top'
      ? [cx, y, 0, -1]
      : lot.side === 'bottom'
        ? [cx, y + h - 1, 0, 1]
        : lot.side === 'left'
          ? [x, cy, -1, 0]
          : [x + w - 1, cy, 1, 0];
  for (let k = 1; k <= max; k++)
    if (getTile(p.grid, sx + dx * k, sy + dy * k) === Tile.Road) return true;
  return false;
}

test('el mapa mide 150×150', () => {
  expect(MAP_SIZE).toBe(150);
  const p = planMap(createRng(1));
  expect(p.grid.width).toBe(150);
  expect(p.grid.height).toBe(150);
});

test('misma semilla, mismo trazado', () => {
  expect(planMap(createRng(7))).toEqual(planMap(createRng(7)));
});

describe.each(SEEDS)('semilla %i', (seed) => {
  const p = planMap(createRng(seed));
  const inTown = (l: Lot) => contains(p.town, { x: l.rect.x, y: l.rect.y });
  const of = (kind: string) => p.lots.filter((l) => l.kind === kind);

  test('en el pueblo, una de cada tienda; fuera, gasolinera, nave, dos granjas y 3–5 casas', () => {
    for (const k of SHOPS) {
      expect(of(k)).toHaveLength(1);
      expect(inTown(of(k)[0]!)).toBe(true);
    }
    expect(of('gas')).toHaveLength(1);
    expect(of('warehouse')).toHaveLength(1);
    expect(of('farm')).toHaveLength(2);
    for (const k of ['gas', 'warehouse', 'farm'])
      for (const l of of(k)) expect(inTown(l)).toBe(false);
    const loose = of('house').filter((l) => !inTown(l)).length;
    expect(loose).toBeGreaterThanOrEqual(3);
    expect(loose).toBeLessThanOrEqual(5);
    expect(of('house').filter(inTown).length).toBeGreaterThanOrEqual(6);
    expect(of('base')).toHaveLength(1);
  });

  test('nada se solapa (con 2 casillas de paso), nada pisa carretera y todo cabe en el mapa', () => {
    p.lots.forEach((l, i) => {
      for (const o of p.lots.slice(i + 1)) expect(gap(l.rect, o.rect)).toBeGreaterThanOrEqual(2);
      const { x, y, w, h } = l.rect;
      expect(x).toBeGreaterThanOrEqual(2);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(x + w).toBeLessThanOrEqual(MAP_SIZE - 2);
      expect(y + h).toBeLessThanOrEqual(MAP_SIZE - 2);
      for (let j = y; j < y + h; j++)
        for (let i2 = x; i2 < x + w; i2++) expect(getTile(p.grid, i2, j)).not.toBe(Tile.Road);
    });
  });

  test('la puerta de cada edificio mira a una calle o carretera cercana', () => {
    for (const l of p.lots) expect(roadInFront(p, l, 10), `${l.kind}`).toBe(true);
  });

  test('el pueblo está dentro del mapa y la carretera principal lo atraviesa', () => {
    const t = p.town;
    expect(t.x).toBeGreaterThanOrEqual(2);
    expect(t.y).toBeGreaterThanOrEqual(2);
    expect(t.x + t.w).toBeLessThanOrEqual(MAP_SIZE - 2);
    expect(t.y + t.h).toBeLessThanOrEqual(MAP_SIZE - 2);
    expect(t.w).toBeGreaterThanOrEqual(56);
    expect(t.h).toBeGreaterThanOrEqual(56);
    // La carretera sale del pueblo por los dos lados hasta el borde del mapa.
    const roadAt = (x: number, y: number) => getTile(p.grid, x, y) === Tile.Road;
    const row = (y: number) => [0, MAP_SIZE - 1].every((x) => roadAt(x, y));
    const col = (x: number) => [0, MAP_SIZE - 1].every((y) => roadAt(x, y));
    let crosses = false;
    for (let k = t.y; k < t.y + t.h; k++) if (row(k)) crosses = true;
    for (let k = t.x; k < t.x + t.w; k++) if (col(k)) crosses = true;
    expect(crosses).toBe(true);
  });

  test('ningún árbol en un edificio ni a 2 casillas o menos; ninguno en la carretera', () => {
    const zones = p.lots.map((l) => expand(l.rect, 2));
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++)
        if (getTile(p.grid, x, y) === Tile.Tree)
          expect(zones.some((z) => contains(z, { x, y }))).toBe(false);
  });
});

test('la base sale en el pueblo (~20 %), en las afueras (~40 %) o en el campo (~40 %)', () => {
  const where = { town: 0, outskirts: 0, country: 0 };
  const n = 120;
  for (let seed = 1; seed <= n; seed++) {
    const p = planMap(createRng(seed * 31));
    const base = p.lots.find((l) => l.kind === 'base')!;
    const d = gap(base.rect, p.town);
    if (intersects(base.rect, p.town)) where.town++;
    else if (d >= 4 && d <= 20) where.outskirts++;
    else if (d > 30) where.country++;
    else expect.unreachable(`base a ${d} del pueblo`);
  }
  expect(where.town / n).toBeGreaterThan(0.1);
  expect(where.town / n).toBeLessThan(0.3);
  expect(where.outskirts / n).toBeGreaterThan(0.3);
  expect(where.outskirts / n).toBeLessThan(0.5);
  expect(where.country / n).toBeGreaterThan(0.3);
  expect(where.country / n).toBeLessThan(0.5);
});

test('hay más árboles lejos de las carreteras que cerca (bosque)', () => {
  const p = planMap(createRng(5));
  const roads: { x: number; y: number }[] = [];
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++)
      if (getTile(p.grid, x, y) === Tile.Road) roads.push({ x, y });
  // Por filas y columnas lejos de toda carretera frente a pegadas a ella: basta comparar densidades
  // en franjas.
  let near = 0;
  let nearN = 0;
  let far = 0;
  let farN = 0;
  const roadSet = new Set(roads.map((r) => r.y * MAP_SIZE + r.x));
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++) {
      const t = getTile(p.grid, x, y);
      if (t !== Tile.Grass && t !== Tile.Tree) continue;
      let d = 99;
      for (let r = 1; r <= 25 && d === 99; r++)
        for (const [dx, dy] of [
          [r, 0],
          [-r, 0],
          [0, r],
          [0, -r],
        ] as const)
          if (roadSet.has((y + dy) * MAP_SIZE + x + dx)) d = r;
      if (d <= 4) {
        nearN++;
        if (t === Tile.Tree) near++;
      } else if (d > 25) {
        farN++;
        if (t === Tile.Tree) far++;
      }
    }
  expect(far / farN).toBeGreaterThan((near / nearN) * 2);
});
