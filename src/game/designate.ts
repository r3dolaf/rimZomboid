// Herramienta Saquear: alternar marcas teniendo en cuenta las órdenes aún pendientes
// (con el juego en pausa, la orden no se aplica hasta el siguiente tick).
import { effectiveDesignated, houseMarked, issue, markable } from '../sim/orders';
import type { Point, World } from '../sim/types';

export function toggleHouse(w: World, houseId: number): void {
  issue(w, { type: 'designateHouse', houseId, on: !houseMarked(w, houseId) });
}

export function toggleContainer(w: World, containerId: number): void {
  const c = w.containers.find((x) => x.id === containerId);
  if (c) issue(w, { type: 'designateContainer', containerId, on: !effectiveDesignated(w, c) });
}

/** Arrastrar con Saquear (spec H4d §7): marca los cuerpos vistos del rectángulo entre `a` y `b`. */
export function markCorpsesIn(w: World, a: Point, b: Point): void {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  for (const c of w.containers) {
    const { x, y } = c.pos;
    if (c.kind !== 'corpse' || x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (w.seen[y * w.grid.width + x] !== 1 || !markable(c) || effectiveDesignated(w, c)) continue;
    issue(w, { type: 'designateContainer', containerId: c.id, on: true });
  }
}
