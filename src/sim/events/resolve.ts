// Qué pasa al contestar (o al caducar) cada decisión.
import { logEvent } from '../log';
import { acceptStrangers, leaveStrangers } from '../systems/strangers';
import { resolveBirthday } from './birthday';
import { resolveFlu } from './flu';
import { resolveTheft } from './theft';
import type { Decision, World } from '../types';

/** Opción 0 o 1; `timedOut`, si nadie contestó y se aplica la de por defecto (la 1). */
type Resolver = (w: World, d: Decision, option: 0 | 1, timedOut: boolean) => void;

const RESOLVERS: Record<Decision['kind'], Resolver> = {
  stranger(w, _d, option, timedOut) {
    const st = w.stranger;
    if (st === null || st.leaving) return;
    const names = st.survivors.map((s) => s.name);
    if (option === 0) return acceptStrangers(w);
    logEvent(w, timedOut ? { kind: 'strangerLeft', names } : { kind: 'strangerRejected', names });
    leaveStrangers(w);
  },
  theft: (w, d, option) => resolveTheft(w, d, option),
  birthday: (w, d, option) => resolveBirthday(w, d, option),
  flu: (w, d, option) => resolveFlu(w, d, option),
};

/** Quita la decisión y aplica la opción elegida. */
export function resolveDecision(w: World, id: number, option: 0 | 1, timedOut = false): void {
  const d = w.decisions.find((x) => x.id === id);
  if (!d) return;
  w.decisions = w.decisions.filter((x) => x !== d);
  RESOLVERS[d.kind](w, d, option, timedOut);
}

/** Las que caducan se resuelven con la opción por defecto (la 1). */
export function expireDecisions(w: World): void {
  for (const d of [...w.decisions]) if (w.tick >= d.expiresAt) resolveDecision(w, d.id, 1, true);
}
