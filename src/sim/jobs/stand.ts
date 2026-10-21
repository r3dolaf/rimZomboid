// Dónde ponerse para trabajar en una casilla.
import { inBounds, isWalkable } from '../map/grid';
import { regionOf } from '../path/astar';
import type { Point, Survivor, World } from '../types';
import { tileOf } from '../world';

/** La casilla transitable junto a `p` (8 vecinas), alcanzable por `s`, más cercana a él. */
export function standBeside(w: World, s: Survivor, p: Point): Point | null {
  const at = tileOf(s.pos);
  const region = regionOf(w.grid, at.x, at.y);
  let best: Point | null = null;
  let bestD = Infinity;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = p.x + dx;
      const y = p.y + dy;
      if ((dx === 0 && dy === 0) || !inBounds(w.grid, x, y) || !isWalkable(w.grid, x, y)) continue;
      if (regionOf(w.grid, x, y) !== region) continue;
      const d = (x - at.x) ** 2 + (y - at.y) ** 2;
      if (d < bestD) {
        best = { x, y };
        bestD = d;
      }
    }
  return best;
}

/** `p` si es transitable y alcanzable por `s`; si no, la casilla de al lado más cercana. */
export function standOnOrBeside(w: World, s: Survivor, p: Point): Point | null {
  const at = tileOf(s.pos);
  if (isWalkable(w.grid, p.x, p.y) && regionOf(w.grid, p.x, p.y) === regionOf(w.grid, at.x, at.y))
    return { ...p };
  return standBeside(w, s, p);
}

/** ¿Está `s` en `p` o en una casilla de al lado? */
export function atOrBeside(s: Survivor, p: Point): boolean {
  const t = tileOf(s.pos);
  return Math.max(Math.abs(t.x - p.x), Math.abs(t.y - p.y)) <= 1;
}
