// Decisiones del jugador (spec H3c §4): las crean los sucesos y se contestan con la orden `decide`.
import { DECISION_TICKS } from './balance';
import type { Decision, World } from './types';

/** Añade una decisión pendiente que caduca en DECISION_TICKS. */
export function addDecision(
  w: World,
  kind: Decision['kind'],
  survivorIds: number[],
  extra: Partial<Pick<Decision, 'guilty' | 'worse'>> = {},
): Decision {
  const d: Decision = {
    id: w.nextId++,
    kind,
    survivorIds,
    expiresAt: w.tick + DECISION_TICKS,
    ...extra,
  };
  w.decisions.push(d);
  return d;
}

/** ¿Hay ya una respuesta pendiente para esta decisión? (Para ocultar el aviso aunque esté en pausa.) */
export function decisionAnswered(w: World, id: number): boolean {
  return w.orders.some((o) => o.type === 'decide' && o.decisionId === id);
}
