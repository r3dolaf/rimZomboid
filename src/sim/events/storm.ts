// Suceso 11, Tormenta (spec H3c §3.3).
import { STORM_HOURS_MAX, STORM_HOURS_MIN, TICKS_PER_HOUR } from '../balance';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { nextInt } from '../rng';
import type { GameEvent } from './types';

export const stormEvent: GameEvent = {
  id: 'storm',
  tone: 'bad',
  severity: 1,
  cooldownDays: 4,
  canHappen: (w) => w.tick >= w.stormUntil,
  happen(w) {
    w.stormUntil =
      w.tick + nextInt(w.rng, STORM_HOURS_MIN * TICKS_PER_HOUR, STORM_HOURS_MAX * TICKS_PER_HOUR);
    for (const s of w.survivors) addMemory(s, 'storm', w.tick);
    logEvent(w, { kind: 'storm' });
  },
};
