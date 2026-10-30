// H5c2 §1: el mundo sale de la semilla, con bosques, colinas, ríos, pueblos y carreteras.
import { expect, test } from 'vitest';
import { ATLAS_SIZE, ATLAS_TOWNS, TOWN_MIN_DIST } from '../balance';
import { createRng } from '../rng';
import type { Terrain } from '../types';
import { generateAtlas, river } from './generate';
import { hexDistance, hexIndex, neighbors } from './hex';
import { cheapestPath } from './search';

test('misma semilla, mismo mundo; otra semilla, otro', () => {
  expect(generateAtlas(7)).toEqual(generateAtlas(7));
  expect(generateAtlas(7).terrain).not.toEqual(generateAtlas(8).terrain);
});

test('la base, en el centro, en un pueblo y nunca en el agua; empieza todo con niebla', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const a = generateAtlas(seed);
    expect(a.width).toBe(ATLAS_SIZE.width);
    expect(a.base).toBe(hexIndex(a, ATLAS_SIZE.width >> 1, ATLAS_SIZE.height >> 1));
    expect(a.terrain[a.base]).not.toBe('water');
    expect(a.town[a.base]).toBe(1);
    expect(a.seen.every((x) => x === 0)).toBe(true);
  }
});

test('bosque, colinas y algún río; pueblos separados, fuera del agua y unidos por carretera', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const a = generateAtlas(seed);
    const n = a.width * a.height;
    const share = (t: string) => a.terrain.filter((x) => x === t).length / n;
    expect(share('forest')).toBeGreaterThan(0.12);
    expect(share('forest')).toBeLessThan(0.45);
    expect(share('hills')).toBeGreaterThan(0.04);
    expect(share('water')).toBeGreaterThan(0.01);
    expect(share('water')).toBeLessThan(0.15);
    const towns = a.town.flatMap((t, i) => (t === 1 && i !== a.base ? [i] : []));
    expect(towns.length).toBeGreaterThanOrEqual(ATLAS_TOWNS[0]);
    expect(towns.length).toBeLessThanOrEqual(ATLAS_TOWNS[1]);
    for (const t of towns) {
      expect(a.terrain[t]).not.toBe('water');
      expect(hexDistance(a, t, a.base)).toBeGreaterThanOrEqual(TOWN_MIN_DIST);
      for (const u of towns)
        if (u !== t) expect(hexDistance(a, t, u)).toBeGreaterThanOrEqual(TOWN_MIN_DIST);
      // Se llega de la base a cada pueblo sin salir de la carretera.
      const onRoad = (i: number) => (a.road[i] === 1 || i === a.base ? 1 : Infinity);
      expect(cheapestPath(a, a.base, t, onRoad, 1), `semilla ${seed}`).not.toBeNull();
    }
    // Las carreteras van de hexágono en hexágono (ningún trozo suelto lejos de otro).
    for (let i = 0; i < n; i++)
      if (a.road[i] === 1)
        expect(neighbors(a, i).some((j) => a.road[j] === 1 || j === a.base)).toBe(true);
  }
});

test('un río va de un borde al de enfrente sin huecos, de vecino en vecino', () => {
  const size = { width: ATLAS_SIZE.width, height: ATLAS_SIZE.height };
  for (let seed = 1; seed <= 30; seed++) {
    const terrain: Terrain[] = new Array<Terrain>(size.width * size.height).fill('field');
    river(size, terrain, createRng(seed));
    const water = terrain.flatMap((t, i) => (t === 'water' ? [i] : []));
    // Una sola pieza.
    const seen = new Set([water[0]!]);
    for (const queue = [water[0]!]; queue.length > 0;)
      for (const j of neighbors(size, queue.pop()!))
        if (terrain[j] === 'water' && !seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
    expect(seen.size, `semilla ${seed}`).toBe(water.length);
    // De borde a borde: de arriba abajo o de izquierda a derecha.
    const rows = water.map((i) => Math.floor(i / size.width));
    const cols = water.map((i) => i % size.width);
    const downward = Math.min(...rows) === 0 && Math.max(...rows) === size.height - 1;
    const across = Math.min(...cols) === 0 && Math.max(...cols) === size.width - 1;
    expect(downward || across, `semilla ${seed}`).toBe(true);
  }
});

test('los ríos parten la tierra: se cruzan por puentes (carretera sobre el agua)', () => {
  let bridges = 0;
  let split = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const a = generateAtlas(seed);
    bridges += a.terrain.filter((t, i) => t === 'water' && a.road[i] === 1).length;
    // Sin puentes ni agua: ¿se llega a toda la tierra desde la base?
    const land = a.terrain.flatMap((t, i) => (t !== 'water' ? [i] : []));
    const reach = new Set([a.base]);
    for (const queue = [a.base]; queue.length > 0;)
      for (const j of neighbors(a, queue.pop()!))
        if (a.terrain[j] !== 'water' && !reach.has(j)) {
          reach.add(j);
          queue.push(j);
        }
    if (reach.size < land.length) split++;
  }
  expect(bridges).toBeGreaterThan(0);
  expect(split).toBeGreaterThanOrEqual(10); // casi siempre hay tierra al otro lado de un río
});
