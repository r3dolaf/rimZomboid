import { ordersSystem } from './orders';
import { activitiesSystem } from './systems/activities';
import { decisionsSystem } from './systems/decisions';
import { moodSystem } from './systems/mood';
import { movementSystem } from './systems/movement';
import { needsSystem } from './systems/needs';
import { socialSystem } from './systems/social';
import { strangerSystem } from './systems/strangers';
import type { World } from './types';
import { visionSystem } from './vision';
import { reservationsSystem } from './work';

/** Avanza la simulación un tick. Orden del spec §3, limitado a los sistemas que ya existen. */
export function step(w: World): void {
  ordersSystem(w);
  needsSystem(w);
  moodSystem(w);
  socialSystem(w);
  decisionsSystem(w);
  movementSystem(w);
  strangerSystem(w);
  activitiesSystem(w);
  reservationsSystem(w);
  visionSystem(w);
  w.tick++;
}
