// Suceso Asedio (spec H4e §2.2): se anuncia con 2–3 días de aviso; la llegada la lleva hordeSystem.
import {
  SIEGE_COOLDOWN_DAYS,
  SIEGE_FIRST_DAY,
  SIEGE_WARNING_HOURS,
  TICKS_PER_HOUR,
} from '../balance';
import { dayStart } from '../clock';
import { logEvent } from '../log';
import { nextInt } from '../rng';
import type { MapSide } from '../types';
import { siegeActive, siegeSize } from '../zombies/hordes';
import type { GameEvent } from './types';

export const siegeEvent: GameEvent = {
  id: 'siege',
  tone: 'bad',
  severity: 3,
  cooldownDays: SIEGE_COOLDOWN_DAYS,
  canHappen: (w) => w.tick >= dayStart(SIEGE_FIRST_DAY) && w.siege === null && !siegeActive(w),
  happen(w) {
    const [lo, hi] = SIEGE_WARNING_HOURS;
    const at = w.tick + nextInt(w.rng, lo * TICKS_PER_HOUR, hi * TICKS_PER_HOUR);
    const side = nextInt(w.rng, 0, 3) as MapSide;
    w.siege = { at, side, size: siegeSize(w) };
    logEvent(w, {
      kind: 'siegeAnnounced',
      side,
      hours: Math.round((at - w.tick) / TICKS_PER_HOUR),
    });
  },
};
