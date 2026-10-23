// Qué pasa al contestar (o al caducar) cada decisión.
import { logEvent } from '../log';
import { acceptStrangers, leaveStrangers } from '../systems/strangers';
import { resolveBirthday } from './birthday';
import { resolveTheft } from './theft';
import { resolveFever } from '../illness';
import type { Decision, World } from '../types';

export type DecisionOption = 0 | 1 | 2;

/** La que se aplica si nadie contesta: la 1 (no hacer nada), salvo la fiebre, Que descanse. */
export const DEFAULT_OPTION: Record<Decision['kind'], DecisionOption> = {
  stranger: 1,
  theft: 1,
  birthday: 1,
  fever: 0,
};

/** `timedOut`, si nadie contestó y se aplica la de por defecto. */
type Resolver = (w: World, d: Decision, option: DecisionOption, timedOut: boolean) => void;

const RESOLVERS: Record<Decision['kind'], Resolver> = {
  stranger(w, _d, option, timedOut) {
    const st = w.stranger;
    if (st === null || st.leaving) return;
    const names = st.survivors.map((s) => s.name);
    if (option === 0) return acceptStrangers(w);
    logEvent(w, timedOut ? { kind: 'strangerLeft', names } : { kind: 'strangerRejected', names });
    leaveStrangers(w);
  },
  theft: (w, d, option) => resolveTheft(w, d, option === 0 ? 0 : 1),
  birthday: (w, d, option) => resolveBirthday(w, d, option === 0 ? 0 : 1),
  fever: (w, d, option) => resolveFever(w, d, option),
};

/** Quita la decisión y aplica la opción elegida. */
export function resolveDecision(
  w: World,
  id: number,
  option: DecisionOption,
  timedOut = false,
): void {
  const d = w.decisions.find((x) => x.id === id);
  if (!d) return;
  w.decisions = w.decisions.filter((x) => x !== d);
  RESOLVERS[d.kind](w, d, option, timedOut);
}

/** Las que caducan se resuelven con su opción por defecto. */
export function expireDecisions(w: World): void {
  for (const d of [...w.decisions])
    if (w.tick >= d.expiresAt) resolveDecision(w, d.id, DEFAULT_OPTION[d.kind], true);
}
