// Llueve (spec H5b §6): un suceso bueno que llena los cubos de fuera, las cisternas y el barreño.
import { RAIN_HOURS_MAX, RAIN_HOURS_MIN, TICKS_PER_HOUR } from '../balance';
import { logEvent } from '../log';
import { nextInt } from '../rng';
import type { GameEvent } from './types';

export const rainEvent: GameEvent = {
  id: 'rain',
  tone: 'good',
  cooldownDays: 2,
  canHappen: (w) => w.tick >= w.common.rainUntil,
  happen(w) {
    w.common.rainUntil =
      w.tick + nextInt(w.rng, RAIN_HOURS_MIN * TICKS_PER_HOUR, RAIN_HOURS_MAX * TICKS_PER_HOUR);
    logEvent(w, { kind: 'rain' });
  },
};
