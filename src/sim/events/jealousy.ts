// Suceso 2, Celos (spec H3c §3.1).
import { JEALOUSY_ADMIRER, JEALOUSY_COUPLE_OPINION, JEALOUSY_OPINION } from '../balance';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { pick } from '../rng';
import { changeOpinion, opinionOf } from '../social';
import type { Survivor, World } from '../types';
import { byId } from './helpers';
import type { GameEvent } from './types';

/** (celoso, su pareja, el tercero que aprecia a su pareja). */
function triples(w: World): [Survivor, Survivor, Survivor][] {
  const out: [Survivor, Survivor, Survivor][] = [];
  for (const a of w.survivors) {
    const b = a.partnerId === null ? undefined : byId(w, a.partnerId);
    if (!b) continue;
    for (const c of w.survivors)
      if (c !== a && c !== b && opinionOf(c, b.id) >= JEALOUSY_ADMIRER) out.push([a, b, c]);
  }
  return out;
}

export const jealousyEvent: GameEvent = {
  id: 'jealousy',
  tone: 'bad',
  severity: 2,
  cooldownDays: 5,
  canHappen: (w) => triples(w).length > 0,
  happen(w) {
    const [a, b, c] = pick(w.rng, triples(w));
    addMemory(a, 'jealous', w.tick, c.id);
    changeOpinion(a, c.id, -JEALOUSY_OPINION);
    changeOpinion(a, b.id, -JEALOUSY_COUPLE_OPINION);
    changeOpinion(b, a.id, -JEALOUSY_COUPLE_OPINION);
    logEvent(w, { kind: 'jealousy', survivorId: a.id, otherId: c.id, partnerId: b.id });
  },
};
