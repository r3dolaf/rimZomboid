// Suceso 8, Cumpleaños (spec H3c §3.2): celebrarlo cuesta comida y un rival puede amargarlo.
import {
  BIRTHDAY_CANS,
  BIRTHDAY_OPINION,
  BIRTHDAY_RUIN_CHANCE,
  BIRTHDAY_RUIN_OPINION,
  RIVAL_OPINION,
} from '../balance';
import { addDecision } from '../decisions';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { nextFloat, pick } from '../rng';
import { changeOpinion, opinionOf } from '../social';
import type { Decision, World } from '../types';
import { byId } from './helpers';
import type { GameEvent } from './types';

export const birthdayEvent: GameEvent = {
  id: 'birthday',
  tone: 'good',
  cooldownDays: 5,
  canHappen: (w) => w.survivors.some((s) => !s.celebrated),
  happen(w) {
    const s = pick(
      w.rng,
      w.survivors.filter((x) => !x.celebrated),
    );
    s.celebrated = true;
    addDecision(w, 'birthday', [s.id]);
    logEvent(w, { kind: 'birthday', survivorId: s.id });
  },
};

/** Opción 0, Celebrarlo con 2 latas (si las hay); opción 1 (y por defecto), No hay para fiestas. */
export function resolveBirthday(w: World, d: Decision, option: 0 | 1): void {
  const s = byId(w, d.survivorIds[0]!);
  if (!s) return;
  if (option === 1 || w.storage.items.food < BIRTHDAY_CANS) {
    addMemory(s, 'forgottenBirthday', w.tick);
    logEvent(w, { kind: 'birthdaySkipped', survivorId: s.id });
    return;
  }
  w.storage.items.food -= BIRTHDAY_CANS;
  const others = w.survivors.filter((o) => o !== s);
  // El peor rival puede amargárselo (se mira antes del +5 de la fiesta).
  let rival = others.find((o) => opinionOf(o, s.id) <= RIVAL_OPINION);
  for (const o of others) if (rival && opinionOf(o, s.id) < opinionOf(rival, s.id)) rival = o;
  for (const o of others) {
    addMemory(o, 'party', w.tick);
    changeOpinion(o, s.id, BIRTHDAY_OPINION);
  }
  if (rival && nextFloat(w.rng) < BIRTHDAY_RUIN_CHANCE) {
    addMemory(s, 'ruinedBirthday', w.tick, rival.id);
    changeOpinion(s, rival.id, -BIRTHDAY_RUIN_OPINION);
    logEvent(w, { kind: 'birthdayRuined', survivorId: s.id, otherId: rival.id });
    return;
  }
  addMemory(s, 'happyBirthday', w.tick);
  logEvent(w, { kind: 'birthdayParty', survivorId: s.id });
}
