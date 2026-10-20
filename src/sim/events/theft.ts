// Suceso 1, Raciones robadas (spec H3c §3.1): faltan latas y el grupo sospecha de alguien.
import {
  THEFT_CANS_MAX,
  THEFT_GUILTY_CHANCE,
  THEFT_HUNGRY_BELOW,
  THEFT_MIN_FOOD,
  THEFT_SUSPICION,
  THEFT_UNFAIR_OPINION,
} from '../balance';
import { addDecision } from '../decisions';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { nextFloat, nextInt, weightedPick } from '../rng';
import { changeOpinion } from '../social';
import type { Decision, Survivor, World } from '../types';
import { byId } from './helpers';
import type { GameEvent } from './types';

/** Lo fácil que es que alguien sea el sospechoso: hambre, Glotón y Pesimista. */
function suspicion(s: Survivor): number {
  let p = 1;
  if (s.needs.hunger < THEFT_HUNGRY_BELOW) p *= 2;
  if (s.traits.includes('glutton')) p *= 2;
  if (s.traits.includes('pessimist')) p *= 1.5;
  return p;
}

export const theftEvent: GameEvent = {
  id: 'theft',
  tone: 'bad',
  severity: 3,
  cooldownDays: 6,
  canHappen: (w) => w.storage.items.food >= THEFT_MIN_FOOD && w.survivors.length >= 3,
  happen(w) {
    const cans = nextInt(w.rng, 1, Math.min(THEFT_CANS_MAX, w.storage.items.food));
    w.storage.items.food -= cans;
    const weights: Record<string, number> = {};
    w.survivors.forEach((s, i) => (weights[i] = suspicion(s)));
    const suspect = w.survivors[Number(weightedPick(w.rng, weights))]!;
    const guilty = nextFloat(w.rng) < THEFT_GUILTY_CHANCE;
    for (const o of w.survivors) if (o !== suspect) changeOpinion(o, suspect.id, -THEFT_SUSPICION);
    addDecision(w, 'theft', [suspect.id], { guilty });
    logEvent(w, { kind: 'theft', suspectId: suspect.id, cans });
  },
};

/** Opción 0, Castigar; opción 1 (y por defecto), Dejarlo estar. */
export function resolveTheft(w: World, d: Decision, option: 0 | 1): void {
  const suspect = byId(w, d.survivorIds[0]!);
  if (!suspect) return;
  const others = w.survivors.filter((s) => s !== suspect);
  if (option === 0) {
    if (d.guilty) addMemory(suspect, 'punished', w.tick);
    else {
      addMemory(suspect, 'punishedUnfairly', w.tick);
      for (const o of others) changeOpinion(suspect, o.id, -THEFT_UNFAIR_OPINION);
    }
    logEvent(w, { kind: 'theftPunished', suspectId: suspect.id, guilty: d.guilty === true });
    return;
  }
  for (const o of others) {
    changeOpinion(o, suspect.id, -THEFT_SUSPICION);
    addMemory(o, 'thiefAmongUs', w.tick);
  }
  logEvent(w, { kind: 'theftIgnored', suspectId: suspect.id });
}
