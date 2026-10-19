import type { Survivor, World } from '../sim/types';

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
