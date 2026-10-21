// Ruido y luz que atraen a los zombis (spec H4b §3).
import { CAMPFIRE_SIGHT } from './balance';
import { darkness } from './clock';
import type { Point, World, Zombie } from './types';
import { lineOfSight } from './vision';
import { tileOf } from './world';

/**
 * Un ruido en `pos` (posición continua): los zombis a `radius` casillas o menos, en línea recta y
 * sin mirar muros, quedan alertados hacia allí. Los que ya persiguen a alguien siguen con lo suyo.
 */
export function makeNoise(w: World, pos: Point, radius: number): void {
  const goal = tileOf(pos);
  for (const z of w.zombies) {
    if (z.state === 'chase') continue;
    if ((z.pos.x - pos.x) ** 2 + (z.pos.y - pos.y) ** 2 > radius * radius) continue;
    z.state = 'alert';
    z.goal = { ...goal };
    z.path = [];
    z.lastSeenAt = w.tick;
  }
}

/** La hoguera que ve el zombi de noche (la más cercana, en línea recta), o `null`. */
export function visibleCampfire(w: World, z: Zombie): Point | null {
  if (darkness(w.tick) <= 0) return null;
  const at = tileOf(z.pos);
  let best: Point | null = null;
  let bestD = CAMPFIRE_SIGHT * CAMPFIRE_SIGHT;
  for (const f of w.furniture) {
    if (f.kind !== 'campfire') continue;
    const d = (f.pos.x + 0.5 - z.pos.x) ** 2 + (f.pos.y + 0.5 - z.pos.y) ** 2;
    if (d > bestD || !lineOfSight(w.grid, at, f.pos)) continue;
    best = { ...f.pos };
    bestD = d;
  }
  return best;
}
