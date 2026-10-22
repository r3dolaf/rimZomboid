// Suceso Errantes (spec H4e §2.3): una horda cruza el mapa de un borde al de enfrente.
import { WANDERERS_COOLDOWN_DAYS, WANDERERS_FIRST_DAY } from '../balance';
import { dayStart } from '../clock';
import { nextInt } from '../rng';
import type { MapSide } from '../types';
import { spawnWanderers, wanderersSize } from '../zombies/hordes';
import type { GameEvent } from './types';

export const wanderersEvent: GameEvent = {
  id: 'wanderers',
  tone: 'bad',
  severity: 2,
  cooldownDays: WANDERERS_COOLDOWN_DAYS,
  canHappen: (w) => w.tick >= dayStart(WANDERERS_FIRST_DAY),
  happen(w) {
    const side = nextInt(w.rng, 0, 3) as MapSide;
    spawnWanderers(w, side, wanderersSize(w));
  },
};
