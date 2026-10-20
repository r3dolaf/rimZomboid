// Relaciones entre supervivientes: opinión y etiquetas.
import {
  CHAT_LOW_MOOD_ARGUE,
  CHAT_LOW_MOOD_INSULT,
  CHAT_OPINION_ARGUE,
  CHAT_OPINION_INSULT,
  CHAT_OPINION_PLEASANT,
  CHAT_OPTIMIST_PLEASANT,
  CHAT_PESSIMIST_ARGUE,
  CHAT_PESSIMIST_PLEASANT,
  CHAT_WEIGHTS,
  CLASH_ARGUE,
  CLASH_INSULT,
  FRIEND_OPINION,
  MOOD_EDGE,
  OPINION_LIMIT,
  RIVAL_OPINION,
} from './balance';
import type { Survivor } from './types';

export type RelationLabel = 'partner' | 'friend' | 'rival';

/** Despierto, sin crisis (ni yendo a tenerla), sin pelear y sin consolar ni ser consolado. */
export function isAvailable(s: Survivor): boolean {
  const a = s.action;
  if (a.type === 'sleep' || a.type === 'crisis' || a.type === 'fight') return false;
  if (a.type === 'console' || a.type === 'consoled') return false;
  return !(a.type === 'moveTo' && a.then?.type === 'crisis');
}

/** ¿Hay un "No soporta a X" entre los dos? (Los recuerdos caducados ya los quita needsSystem.) */
export function clashing(a: Survivor, b: Survivor): boolean {
  const c = (x: Survivor, y: Survivor) =>
    x.memories.some((m) => m.id === 'clash' && m.otherId === y.id);
  return c(a, b) || c(b, a);
}
export type ChatKind = 'pleasant' | 'neutral' | 'argue' | 'insult';

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

/** Pesos de cada tipo de charla que `a` inicia con `b` (spec H3b §3). Nunca negativos. */
export function chatWeights(a: Survivor, b: Survivor): Record<ChatKind, number> {
  const o = opinionOf(a, b.id);
  const low = a.needs.mood < MOOD_EDGE || b.needs.mood < MOOD_EDGE;
  let pleasant: number = CHAT_WEIGHTS.pleasant + CHAT_OPINION_PLEASANT * o;
  let argue: number = CHAT_WEIGHTS.argue + CHAT_OPINION_ARGUE * o;
  let insult: number = CHAT_WEIGHTS.insult + CHAT_OPINION_INSULT * Math.min(0, o);
  if (low) {
    argue += CHAT_LOW_MOOD_ARGUE;
    insult += CHAT_LOW_MOOD_INSULT;
  }
  if (a.traits.includes('optimist')) pleasant += CHAT_OPTIMIST_PLEASANT;
  if (a.traits.includes('pessimist')) {
    pleasant += CHAT_PESSIMIST_PLEASANT;
    argue += CHAT_PESSIMIST_ARGUE;
  }
  // Con un choque de caracteres (H3c) discuten más y pueden insultarse aunque estén bien.
  const clash = clashing(a, b);
  if (clash) {
    argue += CLASH_ARGUE;
    insult += CLASH_INSULT;
  }
  // Solo insulta a quien le cae mal o si él mismo está al límite.
  if (!(o < 0 || a.needs.mood < MOOD_EDGE || clash)) insult = 0;
  const pos = (v: number) => Math.max(0, Math.round(v * 1000) / 1000);
  return {
    pleasant: pos(pleasant),
    neutral: CHAT_WEIGHTS.neutral,
    argue: pos(argue),
    insult: pos(insult),
  };
}
