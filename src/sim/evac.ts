// El helicóptero en el mapa del punto de evacuación (spec C1 §3), sin nada más: si está allí ahora,
// su zona y la casilla de ella más cercana. Lo usan el cerebro, Sanar y la pantalla.
import { contains } from './geom';
import { isWalkable } from './map/grid';
import type { Point, Rect, World } from './types';
import { tileOf } from './world';

/** La zona de aterrizaje de ese mapa si el helicóptero está posado en ella ahora, o `null`. */
export function heliZone(w: World): Rect | null {
  const r = w.common.rescue;
  if (!r?.landed || r.siteId !== w.mapId || !w.evacZone) return null;
  if (r.from === null || r.until === null || w.tick < r.from || w.tick >= r.until) return null;
  return w.evacZone;
}

/** ¿Está esa posición (continua) en la zona? */
export const inZone = (zone: Rect, pos: Point): boolean => contains(zone, tileOf(pos));

/** La casilla de la zona que se pisa más cerca de `from`, o `null`. */
export function zoneTile(w: World, zone: Rect, from: Point): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (let y = zone.y; y < zone.y + zone.h; y++)
    for (let x = zone.x; x < zone.x + zone.w; x++) {
      if (!isWalkable(w.grid, x, y)) continue;
      const d = (x + 0.5 - from.x) ** 2 + (y + 0.5 - from.y) ** 2;
      if (d < bestD) {
        best = { x, y };
        bestD = d;
      }
    }
  return best;
}

/** El centro de la zona (adonde van los zombis al oír el helicóptero). */
export const zoneCenter = (zone: Rect): Point => ({
  x: zone.x + zone.w / 2,
  y: zone.y + zone.h / 2,
});
