import { contains } from '../sim/geom';
import type { Building, Container, Survivor, World } from '../sim/types';

/** El superviviente más cercano a (x, y), en casillas, dentro de `radius`; o `null`. */
export function survivorAt(w: World, x: number, y: number, radius: number): Survivor | null {
  let best: Survivor | null = null;
  let bestD = radius * radius;
  for (const s of w.survivors) {
    const d = (s.pos.x - x) ** 2 + (s.pos.y - y) ** 2;
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** La casa (no la base) que contiene la casilla, o `null`. */
export function houseAt(w: World, x: number, y: number): Building | null {
  return w.houses.find((h) => contains(h.rect, { x, y })) ?? null;
}

/** El contenedor de esa casilla, o `null`. */
export function containerAt(w: World, x: number, y: number): Container | null {
  return w.containers.find((c) => c.pos.x === x && c.pos.y === y) ?? null;
}
