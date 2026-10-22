import { contains } from '../sim/geom';
import type { Building, Container, Furniture, Survivor, World } from '../sim/types';

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
  const here = w.containers.filter((c) => c.pos.x === x && c.pos.y === y);
  // Un cuerpo (H4d) va encima del mueble en el que haya caído.
  return here.find((c) => c.kind === 'corpse') ?? here[0] ?? null;
}

/** La mesa vista de esa casilla, o `null` (un clic en ella abre Fabricar, spec H4d §8). */
export function tableAt(w: World, x: number, y: number): Furniture | null {
  if (w.seen[y * w.grid.width + x] !== 1) return null;
  return w.furniture.find((f) => f.kind === 'table' && f.pos.x === x && f.pos.y === y) ?? null;
}
