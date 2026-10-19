import { IDLE_TICKS_MAX, IDLE_TICKS_MIN, SURVIVOR_WALK_SPEED } from '../balance';
import { nextInt } from '../rng';
import type { World } from '../types';

/** Mueve a cada superviviente hacia el centro de la siguiente casilla de su camino. */
export function movementSystem(w: World): void {
  for (const s of w.survivors) {
    if (s.action.type !== 'moveTo') continue;
    const next = s.path[0];
    if (next === undefined) {
      s.action = { type: 'idle', ticksLeft: nextInt(w.rng, IDLE_TICKS_MIN, IDLE_TICKS_MAX) };
      continue;
    }
    const tx = next.x + 0.5;
    const ty = next.y + 0.5;
    const dx = tx - s.pos.x;
    const dy = ty - s.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy); // sqrt es exacto en todos los navegadores; hypot no
    if (dist <= SURVIVOR_WALK_SPEED) {
      s.pos = { x: tx, y: ty };
      s.path.shift();
    } else {
      s.pos = {
        x: s.pos.x + (dx / dist) * SURVIVOR_WALK_SPEED,
        y: s.pos.y + (dy / dist) * SURVIVOR_WALK_SPEED,
      };
    }
  }
}
