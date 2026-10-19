import { activitiesSystem } from './systems/activities';
import { decisionsSystem } from './systems/decisions';
import { moodSystem } from './systems/mood';
import { movementSystem } from './systems/movement';
import { needsSystem } from './systems/needs';
import type { World } from './types';

/** Avanza la simulación un tick. Orden del spec §3, limitado a los sistemas que ya existen. */
export function step(w: World): void {
  needsSystem(w);
  moodSystem(w);
  decisionsSystem(w);
  movementSystem(w);
  activitiesSystem(w);
  w.tick++;
}
