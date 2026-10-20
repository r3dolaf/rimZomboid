// Suceso 4, Malos recuerdos (spec H3c §3.1).
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { pick } from '../rng';
import { isAvailable } from '../social';
import type { GameEvent } from './types';

export const griefEvent: GameEvent = {
  id: 'grief',
  tone: 'bad',
  severity: 2,
  cooldownDays: 3,
  canHappen: (w) => w.survivors.some(isAvailable),
  happen(w) {
    const s = pick(w.rng, w.survivors.filter(isAvailable));
    addMemory(s, 'grief', w.tick);
    logEvent(w, { kind: 'grief', survivorId: s.id });
  },
};
