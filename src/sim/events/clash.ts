// Suceso 3, Choque de caracteres (spec H3c §3.1): dos colonos no se soportan unos días.
import { CLASH_BELOW } from '../balance';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { pick } from '../rng';
import { opinionOf } from '../social';
import type { Survivor, World } from '../types';
import { orderedPairs } from './helpers';
import type { GameEvent } from './types';

/** Parejas (sin repetir) que no son pareja y se tienen < CLASH_BELOW en ambos sentidos. */
function candidates(w: World): [Survivor, Survivor][] {
  return orderedPairs(w).filter(
    ([a, b]) =>
      a.id < b.id &&
      a.partnerId !== b.id &&
      opinionOf(a, b.id) < CLASH_BELOW &&
      opinionOf(b, a.id) < CLASH_BELOW,
  );
}

export const clashEvent: GameEvent = {
  id: 'clash',
  tone: 'bad',
  severity: 2,
  cooldownDays: 4,
  canHappen: (w) => candidates(w).length > 0,
  happen(w) {
    const [a, b] = pick(w.rng, candidates(w));
    addMemory(a, 'clash', w.tick, b.id);
    addMemory(b, 'clash', w.tick, a.id);
    logEvent(w, { kind: 'clash', survivorId: a.id, otherId: b.id });
  },
};
