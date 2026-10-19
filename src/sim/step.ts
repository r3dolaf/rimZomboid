import { decisionsSystem } from './systems/decisions';
import { movementSystem } from './systems/movement';
import type { World } from './types';

/** Avanza la simulación un tick. Orden del spec §3, limitado a los sistemas que ya existen. */
export function step(w: World): void {
  decisionsSystem(w);
  movementSystem(w);
  w.tick++;
}
