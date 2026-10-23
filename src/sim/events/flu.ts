// Suceso 12, Gripe (spec H3c §3.3; desde H5 §7.2, una fiebre como la de la infección): no mata.
import { startFever } from '../illness';
import { pick } from '../rng';
import type { GameEvent } from './types';

export const fluEvent: GameEvent = {
  id: 'flu',
  tone: 'bad',
  severity: 2,
  cooldownDays: 5,
  canHappen: (w) => w.survivors.some((s) => s.fever === null),
  happen(w) {
    const s = pick(
      w.rng,
      w.survivors.filter((x) => x.fever === null),
    );
    startFever(w, s, 'flu');
  },
};
