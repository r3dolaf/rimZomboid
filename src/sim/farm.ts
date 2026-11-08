// El huerto (spec V1 §3): dónde va, marcar y desmarcar parcelas, y cómo crece lo sembrado.
import { occupied } from './build';
import { getTile, inBounds } from './map/grid';
import { Tile, type Plot, type Point, type World } from './types';
import { indoors } from './zombies/spawn';

/** La parcela de esa casilla, o `undefined`. */
export function plotAt(w: World, x: number, y: number): Plot | undefined {
  const i = y * w.grid.width + x;
  return w.plots.find((p) => p.tile === i);
}

/** La casilla de una parcela. */
export const plotPos = (w: World, p: Plot): Point => ({
  x: p.tile % w.grid.width,
  y: Math.floor(p.tile / w.grid.width),
});

/**
 * ¿Puede ir ahí una parcela? En la base (no en los sitios), en hierba vista, fuera de los edificios
 * y sin nada encima (ni otra parcela).
 */
export function canPlot(w: World, p: Point): boolean {
  if (w.mapId !== 0 || !inBounds(w.grid, p.x, p.y)) return false;
  if (w.seen[p.y * w.grid.width + p.x] !== 1 || getTile(w.grid, p.x, p.y) !== Tile.Grass)
    return false;
  return !indoors(w, p.x, p.y) && !occupied(w, p.x, p.y);
}

/** Marca o desmarca una parcela. Desmarcar pierde lo sembrado. */
export function markPlot(w: World, x: number, y: number, on: boolean): void {
  const i = y * w.grid.width + x;
  if (!on) {
    w.plots = w.plots.filter((p) => p.tile !== i);
    return;
  }
  if (canPlot(w, { x, y })) w.plots.push({ tile: i, crop: null, moisture: 0 });
}

/** ¿Está marcada (contando las órdenes pendientes)? */
export function plotMarked(w: World, x: number, y: number): boolean {
  let on = plotAt(w, x, y) !== undefined;
  for (const o of w.orders) if (o.type === 'markPlot' && o.x === x && o.y === y) on = o.on;
  return on;
}
