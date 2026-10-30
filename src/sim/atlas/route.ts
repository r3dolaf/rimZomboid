// Rutas por el mapa del mundo (spec H5c2 §4): las horas de cada hexágono según el terreno y el
// camino más rápido, pasando por las paradas en orden. Se planea con lo que se sabe: en la niebla,
// como si fuera campo.
import { HEX_HOURS } from '../balance';
import type { Atlas } from '../types';
import { cheapestPath } from './search';

/** Las horas de luz para entrar en `i` (carretera o puente, rápido; agua sin puente, imposible). */
export function hexHours(atlas: Atlas, i: number): number {
  if (atlas.road[i] === 1) return HEX_HOURS.road;
  const t = atlas.terrain[i]!;
  return t === 'water' ? Infinity : HEX_HOURS[t];
}

/** Lo que se cree que cuesta `i`: lo de verdad si se conoce; si no, como campo. */
const planned = (atlas: Atlas, i: number) =>
  atlas.seen[i] === 1 ? hexHours(atlas, i) : HEX_HOURS.field;

/** La ruta de `from` a `to` pasando por `waypoints` en orden (los extremos incluidos), o `null`. */
export function findRoute(
  atlas: Atlas,
  from: number,
  to: number,
  waypoints: readonly number[] = [],
): number[] | null {
  const stops = [from, ...waypoints, to];
  const route = [from];
  for (let k = 1; k < stops.length; k++) {
    const leg = cheapestPath(
      atlas,
      stops[k - 1]!,
      stops[k]!,
      (i) => planned(atlas, i),
      HEX_HOURS.road,
    );
    if (!leg) return null;
    route.push(...leg.slice(1));
  }
  return route;
}

/** Las horas que se cree que cuesta la ruta (sin contar el hexágono de salida). */
export function routeHours(atlas: Atlas, route: readonly number[]): number {
  return route.slice(1).reduce((n, i) => n + planned(atlas, i), 0);
}
