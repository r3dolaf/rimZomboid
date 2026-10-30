// La ruta que se está planeando en el mapa del mundo (spec H5c2 §6): de dónde a dónde y con qué
// paradas. Arrastrar un punto de la línea a otro hexágono pone una parada (o mueve la que era);
// el botón derecho sobre una parada la quita. Al mandar, la orden lleva las paradas.
import { findRoute } from '../sim/atlas/route';
import type { Atlas } from '../sim/types';

export interface RoutePlan {
  readonly from: number | null;
  readonly to: number | null;
  readonly waypoints: readonly number[];
  /** Cambia los extremos; si son otros, sin paradas. `null`: nada que planear. */
  set(from: number | null, to: number | null): void;
  /** La ruta con sus paradas, o `null` si no hay nada que planear o no hay camino. */
  route(atlas: Atlas): number[] | null;
  /** Lleva el punto `k` de la ruta a `hex`: si era una parada, la mueve; si no, pone una. */
  drag(atlas: Atlas, k: number, hex: number): boolean;
  /** Quita la parada de `hex` (si la hay). */
  remove(hex: number): boolean;
}

export function createRoutePlan(): RoutePlan {
  let from: number | null = null;
  let to: number | null = null;
  let waypoints: number[] = [];
  const routeWith = (atlas: Atlas, stops: readonly number[]) =>
    from === null || to === null ? null : findRoute(atlas, from, to, stops);
  return {
    get from() {
      return from;
    },
    get to() {
      return to;
    },
    get waypoints() {
      return waypoints;
    },
    set(a, b) {
      if (a === from && b === to) return;
      from = a;
      to = b;
      waypoints = [];
    },
    route: (atlas) => routeWith(atlas, waypoints),
    drag(atlas, k, hex) {
      const path = routeWith(atlas, waypoints);
      if (!path || k <= 0 || k >= path.length - 1 || path[k] === hex) return false;
      // Dónde cae cada parada en la ruta (en orden): las de antes de `k` van delante.
      let before = 0;
      let mine = -1;
      for (let i = 0, j = 0; i <= k && j < waypoints.length; i++)
        if (path[i] === waypoints[j]) {
          if (i === k) mine = j;
          else before = j + 1;
          j++;
        }
      const next = [...waypoints];
      if (mine >= 0) next[mine] = hex;
      else next.splice(before, 0, hex);
      if (!routeWith(atlas, next)) return false;
      waypoints = next;
      return true;
    },
    remove(hex) {
      if (!waypoints.includes(hex)) return false;
      waypoints = waypoints.filter((x) => x !== hex);
      return true;
    },
  };
}
