// H5c2 §4: rutas por el terreno: carretera rápida, bosque y colinas lentos, el agua solo por puentes;
// la niebla cuenta como campo; paradas en orden.
import { expect, test } from 'vitest';
import { HEX_HOURS } from '../balance';
import type { Atlas, Terrain } from '../types';
import { hexIndex } from './hex';
import { findRoute, hexHours, routeHours } from './route';

/** Un mundo de 9 × 7 de campo, todo conocido; la base en (4, 3). */
function atlas(): Atlas {
  const n = 9 * 7;
  return {
    width: 9,
    height: 7,
    terrain: new Array<Terrain>(n).fill('field'),
    road: new Array<number>(n).fill(0),
    town: new Array<number>(n).fill(0),
    seen: new Array<number>(n).fill(1),
    base: hexIndex({ width: 9, height: 7 }, 4, 3),
  };
}
const at = (a: Atlas, c: number, r: number) => hexIndex(a, c, r);

test('horas de cada hexágono según el terreno; el agua sin puente, imposible', () => {
  const a = atlas();
  const i = at(a, 2, 2);
  expect(hexHours(a, i)).toBe(HEX_HOURS.field);
  a.terrain[i] = 'forest';
  expect(hexHours(a, i)).toBe(HEX_HOURS.forest);
  a.terrain[i] = 'hills';
  expect(hexHours(a, i)).toBe(HEX_HOURS.hills);
  a.terrain[i] = 'water';
  expect(hexHours(a, i)).toBe(Infinity);
  a.road[i] = 1; // un puente
  expect(hexHours(a, i)).toBe(HEX_HOURS.road);
});

test('la ruta más rápida: rodea el agua, prefiere la carretera, y sus horas', () => {
  const a = atlas();
  // Un muro de agua en la columna 4 salvo un puente abajo (fila 6).
  for (let r = 0; r < 7; r++) a.terrain[at(a, 4, r)] = 'water';
  a.road[at(a, 4, 6)] = 1;
  const route = findRoute(a, at(a, 1, 3), at(a, 7, 3))!;
  expect(route[0]).toBe(at(a, 1, 3));
  expect(route.at(-1)).toBe(at(a, 7, 3));
  expect(route).toContain(at(a, 4, 6));
  for (const i of route) expect(a.terrain[i] !== 'water' || a.road[i] === 1).toBe(true);
  expect(routeHours(a, route)).toBe(route.slice(1).reduce((n, i) => n + hexHours(a, i), 0));
  a.road[at(a, 4, 6)] = 0; // sin puente, no hay camino
  expect(findRoute(a, at(a, 1, 3), at(a, 7, 3))).toBeNull();
});

test('en la niebla se cuenta como campo (aunque sea bosque o agua)', () => {
  const a = atlas();
  const i = at(a, 5, 3);
  a.terrain[i] = 'water';
  a.seen[i] = 0;
  const route = findRoute(a, at(a, 4, 3), at(a, 6, 3))!;
  expect(route).toContain(i); // no sabe que es agua
  expect(routeHours(a, route)).toBe(2 * HEX_HOURS.field);
});

test('con paradas: pasa por ellas en orden', () => {
  const a = atlas();
  const from = at(a, 0, 0);
  const to = at(a, 8, 0);
  const stop = at(a, 4, 6);
  const route = findRoute(a, from, to, [stop])!;
  expect(route).toContain(stop);
  expect(route.indexOf(stop)).toBeGreaterThan(0);
  expect(new Set(route).size).toBeLessThanOrEqual(route.length);
  expect(route.length).toBeGreaterThan(findRoute(a, from, to)!.length);
});
