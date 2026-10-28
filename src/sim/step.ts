import { clothesSystem } from './clothes';
import { corpsesSystem } from './corpses';
import { combatSystem } from './combat';
import { deathSystem } from './death';
import { furnitureSystem } from './furniture';
import { healthSystem } from './health';
import { illnessSystem } from './illness';
import { carrySystem } from './jobs/heal';
import { narratorSystem } from './narrator';
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
import { zombieSystem } from './zombies/system';
import { reservationsSystem } from './work';

/** Avanza la simulación un tick. Orden del spec §3, limitado a los sistemas que ya existen. */
export function step(w: World): void {
  ordersSystem(w);
  needsSystem(w);
  illnessSystem(w); // H5
  healthSystem(w);
  deathSystem(w); // H5
  furnitureSystem(w);
  clothesSystem(w); // H5b: la ropa puesta se ensucia
  moodSystem(w);
  socialSystem(w);
  narratorSystem(w);
  decisionsSystem(w);
  movementSystem(w);
  zombieSystem(w);
  combatSystem(w);
  strangerSystem(w);
  activitiesSystem(w);
  carrySystem(w); // H4e: el llevado va con quien lo lleva
  corpsesSystem(w);
  reservationsSystem(w);
  visionSystem(w);
  w.tick++;
}
