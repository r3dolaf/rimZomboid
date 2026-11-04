// Un buen día (H6c §2.8): todos de mejor ánimo un rato (no con tormenta).
import { GOOD_DAY_COOLDOWN_DAYS } from '../balance';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import type { GameEvent } from './types';

export const goodDayEvent: GameEvent = {
  id: 'goodDay',
  tone: 'good',
  cooldownDays: GOOD_DAY_COOLDOWN_DAYS,
  canHappen: (w) => w.survivors.length > 0 && w.tick >= w.common.stormUntil,
  happen(w) {
    for (const s of w.survivors) addMemory(s, 'goodDay', w.tick);
    logEvent(w, { kind: 'goodDay' });
  },
};
