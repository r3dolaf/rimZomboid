// Olas de frío y de calor (spec V3 §8): unos grados de más o de menos durante unos días.
import { COLD_SNAP, HEAT_WAVE, TICKS_PER_DAY } from '../balance';
import { logEvent } from '../log';
import { seasonOf } from '../season';
import type { World } from '../types';
import type { GameEvent } from './types';

/** ¿Hay ya una ola en curso? */
const waving = (w: World) => !!w.common.tempShift && w.tick < w.common.tempShift.until;

export const coldSnapEvent: GameEvent = {
  id: 'coldSnap',
  tone: 'bad',
  severity: 2,
  cooldownDays: 8,
  canHappen: (w) => ['autumn', 'winter'].includes(seasonOf(w.tick)) && !waving(w),
  happen(w) {
    w.common.tempShift = {
      value: COLD_SNAP.degrees,
      until: w.tick + COLD_SNAP.days * TICKS_PER_DAY,
    };
    logEvent(w, { kind: 'coldSnap' });
  },
};

export const heatWaveEvent: GameEvent = {
  id: 'heatWave',
  tone: 'bad',
  severity: 1,
  cooldownDays: 8,
  canHappen: (w) => seasonOf(w.tick) === 'summer' && !waving(w),
  happen(w) {
    w.common.tempShift = {
      value: HEAT_WAVE.degrees,
      until: w.tick + HEAT_WAVE.days * TICKS_PER_DAY,
    };
    logEvent(w, { kind: 'heatWave' });
  },
};
