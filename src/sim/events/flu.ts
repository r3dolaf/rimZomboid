// Suceso 12, Gripe (spec H3c §3.3): no mata; descansar la acorta.
import { FLU_DAYS, FLU_REST_DAYS, TICKS_PER_DAY } from '../balance';
import { addDecision } from '../decisions';
import { logEvent } from '../log';
import { pick } from '../rng';
import type { Decision, World } from '../types';
import { byId } from './helpers';
import type { GameEvent } from './types';

export const fluEvent: GameEvent = {
  id: 'flu',
  tone: 'bad',
  severity: 2,
  cooldownDays: 5,
  canHappen: (w) => w.survivors.some((s) => s.sick === null),
  happen(w) {
    const s = pick(
      w.rng,
      w.survivors.filter((x) => x.sick === null),
    );
    s.sick = { until: w.tick + FLU_DAYS * TICKS_PER_DAY, plan: 'undecided' };
    addDecision(w, 'flu', [s.id]);
    logEvent(w, { kind: 'flu', survivorId: s.id });
  },
};

/** Opción 0, Que descanse (se cura a los 2 días de empezar); opción 1 (y por defecto), Que siga trabajando. */
export function resolveFlu(w: World, d: Decision, option: 0 | 1): void {
  const s = byId(w, d.survivorIds[0]!);
  if (!s?.sick) return;
  if (option === 1) {
    s.sick.plan = 'work';
    logEvent(w, { kind: 'fluWork', survivorId: s.id });
    return;
  }
  s.sick.plan = 'rest';
  s.sick.until -= (FLU_DAYS - FLU_REST_DAYS) * TICKS_PER_DAY;
  logEvent(w, { kind: 'fluRest', survivorId: s.id });
}
