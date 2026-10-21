// Caminos de zombi (spec H4b §2.2): lo rompible se cruza rompiéndolo, con un coste.
import {
  ZOMBIE_BREAK_DAMAGE,
  ZOMBIE_HIT_TICKS,
  ZOMBIE_PATH_BUDGET,
  ZOMBIE_SPEED,
} from '../balance';
import { inBounds, isZombieWalkable } from '../map/grid';
import { findCostPath } from '../path/astar';
import { resistanceOf } from '../structures';
import type { Point, World } from '../types';

/**
 * Coste de pisar la casilla: 1 si se pisa; si hay que romperla, 1 más las casillas que andaría
 * en lo que tarda en romperla; `Infinity` si no se puede (árboles, fuera del mapa).
 */
export function zombieStepCost(w: World, x: number, y: number): number {
  if (!inBounds(w.grid, x, y)) return Infinity;
  if (isZombieWalkable(w.grid, x, y)) return 1;
  const left = resistanceOf(w, x, y);
  if (left === undefined) return Infinity;
  return 1 + (left / ZOMBIE_BREAK_DAMAGE) * ZOMBIE_HIT_TICKS * ZOMBIE_SPEED;
}

/** Camino de un zombi de `from` a `to` (sin `from`, con `to`), o `null` si no hay o es muy largo. */
export function zombiePath(
  w: World,
  from: Point,
  to: Point,
  budget = ZOMBIE_PATH_BUDGET,
): Point[] | null {
  return findCostPath(w.grid, from, to, (x, y) => zombieStepCost(w, x, y), budget);
}
