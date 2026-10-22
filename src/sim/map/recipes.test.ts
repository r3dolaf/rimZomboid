// H4f §3: cada tipo de edificio por dentro — tamaño, tabiques, ventanas y muebles; y la base girada.
import { describe, expect, test } from 'vitest';
import { BUILDINGS } from '../balance';
import { baseLayout } from '../base';
import { contains } from '../geom';
import { findPath } from '../path/astar';
import { createRng } from '../rng';
import { Tile, type Building, type ContainerKind, type LootKind } from '../types';
import { generateMap } from './generate';
import { getTile } from './grid';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

/** Clases de mueble que puede tener cada tipo (spec H4f §3). */
const ALLOWED: Record<LootKind, readonly ContainerKind[]> = {
  house: ['fridge', 'wardrobe', 'shelf'],
  supermarket: ['shelf', 'fridge', 'counter'],
  pharmacy: ['medicine', 'counter', 'shelf'],
  hardware: ['shelf', 'crate', 'counter'],
  police: ['locker', 'crate', 'shelf'],
  clothes: ['wardrobe', 'counter'],
  gas: ['counter', 'shelf', 'fridge'],
  farm: ['fridge', 'wardrobe', 'shelf', 'crate'],
  warehouse: ['crate'],
};
/** Las que no pueden faltar. */
const MUST: Partial<Record<LootKind, readonly ContainerKind[]>> = {
  supermarket: ['shelf', 'fridge', 'counter'],
  pharmacy: ['medicine', 'counter'],
  hardware: ['crate'],
  police: ['locker'],
  clothes: ['wardrobe', 'counter'],
  gas: ['counter'],
  farm: ['fridge', 'crate'],
  warehouse: ['crate'],
};

/** Fachada y fondo según hacia dónde mira la puerta. */
function frontDepth(b: Building): [number, number] {
  const top = b.door.y === b.rect.y || b.door.y === b.rect.y + b.rect.h - 1;
  return top ? [b.rect.w, b.rect.h] : [b.rect.h, b.rect.w];
}

/** Ventanas de cada muro exterior: delante (el de la puerta) y los otros tres. */
function windows(grid: ReturnType<typeof generateMap>['grid'], b: Building) {
  const { x, y, w, h } = b.rect;
  const walls = {
    top: Array.from({ length: w }, (_, i) => ({ x: x + i, y })),
    bottom: Array.from({ length: w }, (_, i) => ({ x: x + i, y: y + h - 1 })),
    left: Array.from({ length: h }, (_, j) => ({ x, y: y + j })),
    right: Array.from({ length: h }, (_, j) => ({ x: x + w - 1, y: y + j })),
  };
  const count = (ps: { x: number; y: number }[]) =>
    ps.filter((p) => getTile(grid, p.x, p.y) === Tile.Window).length;
  const front = (Object.keys(walls) as (keyof typeof walls)[]).find((k) =>
    walls[k].some((p) => p.x === b.door.x && p.y === b.door.y),
  )!;
  return {
    front: count(walls[front]),
    others: (Object.keys(walls) as (keyof typeof walls)[])
      .filter((k) => k !== front)
      .map((k) => count(walls[k])),
  };
}

test('misma semilla, mismo mapa (y con edificios de todos los tipos)', () => {
  const a = generateMap(createRng(11));
  expect(a).toEqual(generateMap(createRng(11)));
  const kinds = new Set(a.houses.map((h) => h.kind));
  for (const k of Object.keys(BUILDINGS)) expect(kinds.has(k as LootKind)).toBe(true);
});

describe.each(SEEDS)('semilla %i', (seed) => {
  const m = generateMap(createRng(seed));

  test('cada edificio, de su tamaño, con la puerta en su muro y alcanzable desde la base', () => {
    expect(m.base.kind).toBe('base');
    for (const h of m.houses) {
      const spec = BUILDINGS[h.kind as LootKind];
      const [front, depth] = frontDepth(h);
      expect(front, `${h.kind} ${h.id}`).toBeGreaterThanOrEqual(spec.w[0]);
      expect(front).toBeLessThanOrEqual(spec.w[1]);
      expect(depth).toBeGreaterThanOrEqual(spec.h[0]);
      expect(depth).toBeLessThanOrEqual(spec.h[1]);
      expect(getTile(m.grid, h.door.x, h.door.y)).toBe(Tile.Door);
      expect(findPath(m.grid, m.base.door, h.door)).not.toBeNull();
    }
  });

  test('muebles: cuántos y de qué clase según el tipo, en el suelo y alcanzables desde la puerta', () => {
    for (const h of m.houses) {
      const kind = h.kind as LootKind;
      const mine = m.furniture.filter((f) => f.houseId === h.id);
      const [lo, hi] = BUILDINGS[kind].containers;
      expect(mine.length, `${kind} ${h.id}`).toBeGreaterThanOrEqual(lo);
      expect(mine.length).toBeLessThanOrEqual(hi);
      for (const f of mine) {
        expect(ALLOWED[kind]).toContain(f.kind);
        expect(contains(h.rect, f.pos)).toBe(true);
        expect(getTile(m.grid, f.pos.x, f.pos.y)).toBe(Tile.Floor);
        expect(findPath(m.grid, h.door, f.pos), `${kind} ${h.id} → ${f.kind}`).not.toBeNull();
      }
      for (const k of MUST[kind] ?? []) expect(mine.map((f) => f.kind)).toContain(k);
      const spots = new Set(mine.map((f) => `${f.pos.x},${f.pos.y}`));
      expect(spots.size).toBe(mine.length); // uno por casilla
    }
    expect(m.furniture.some((f) => f.houseId === m.base.id)).toBe(false);
  });

  test('ventanas según el tipo: escaparate en el supermercado, pocas en la nave', () => {
    for (const h of m.houses) {
      const win = windows(m.grid, h);
      if (h.kind === 'supermarket') expect(win.front).toBeGreaterThanOrEqual(4);
      if (h.kind === 'warehouse')
        for (const n of [win.front, ...win.others]) expect(n).toBeLessThanOrEqual(1);
      if (h.kind === 'house') for (const n of win.others) expect(n).toBeGreaterThanOrEqual(1);
    }
  });

  test('la base, girada hacia su calle: 5 sitios de cama en su suelo y el almacén junto a la puerta', () => {
    const { beds, storage } = baseLayout(m.base);
    expect(beds).toHaveLength(5);
    expect(storage).toHaveLength(2);
    for (const p of [...beds, ...storage]) {
      expect(contains(m.base.rect, p)).toBe(true);
      expect(getTile(m.grid, p.x, p.y)).toBe(Tile.Floor);
    }
    for (const p of storage)
      expect(
        Math.max(Math.abs(p.x - m.base.door.x), Math.abs(p.y - m.base.door.y)),
      ).toBeLessThanOrEqual(2);
    for (const b of beds)
      expect(Math.abs(b.x - m.base.door.x) + Math.abs(b.y - m.base.door.y)).toBeGreaterThan(4);
  });
});

test('la base sale mirando a los cuatro lados según la semilla', () => {
  const sides = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const b = generateMap(createRng(seed)).base;
    const { x, y, h } = b.rect;
    sides.add(
      b.door.y === y
        ? 'top'
        : b.door.y === y + h - 1
          ? 'bottom'
          : b.door.x === x
            ? 'left'
            : 'right',
    );
    expect(b.rect.w * b.rect.h).toBe(120);
  }
  expect(sides.size).toBe(4);
});
