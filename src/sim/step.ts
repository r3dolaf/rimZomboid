import { ordersSystem } from './orders';
import { activitiesSystem } from './systems/activities';
import { decisionsSystem } from './systems/decisions';
import { moodSystem } from './systems/mood';
import { movementSystem } from './systems/movement';
import { needsSystem } from './systems/needs';
import type { World } from './types';
import { visionSystem } from './vision';

/** Avanza la simulación un tick. Orden del spec §3, limitado a los sistemas que ya existen. */
export function step(w: World): void {
  ordersSystem(w);
  needsSystem(w);
  moodSystem(w);
  decisionsSystem(w);
  movementSystem(w);
  activitiesSystem(w);
  visionSystem(w);
  w.tick++;
}
