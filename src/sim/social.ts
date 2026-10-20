// Relaciones entre supervivientes: opinión y etiquetas.
import { FRIEND_OPINION, OPINION_LIMIT, RIVAL_OPINION } from './balance';
import type { Survivor } from './types';

export type RelationLabel = 'partner' | 'friend' | 'rival';

/** Lo que `s` opina de `otherId` (0 si no lo conoce). */
export function opinionOf(s: Survivor, otherId: number): number {
  return s.opinions[otherId] ?? 0;
}

/** Suma `delta` a la opinión de `s` sobre `otherId`, sin salir de [−100, 100]. */
export function changeOpinion(s: Survivor, otherId: number, delta: number): void {
  const v = opinionOf(s, otherId) + delta;
  s.opinions[otherId] = Math.min(OPINION_LIMIT, Math.max(-OPINION_LIMIT, v));
}

export function relationLabel(s: Survivor, otherId: number): RelationLabel | null {
  if (s.partnerId === otherId) return 'partner';
  const o = opinionOf(s, otherId);
  if (o >= FRIEND_OPINION) return 'friend';
  if (o <= RIVAL_OPINION) return 'rival';
  return null;
}
