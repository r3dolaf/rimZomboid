// Suceso 5, Disputa por el reparto (spec H3c §3.1).
import { FOOD_FIGHT_OPINION, FOOD_FIGHT_PER_COLONIST } from '../balance';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { changeOpinion } from '../social';
import { orderedPairs, totalFood } from './helpers';
import type { GameEvent } from './types';

export const foodFightEvent: GameEvent = {
  id: 'foodFight',
  tone: 'bad',
  severity: 2,
  cooldownDays: 4,
  canHappen: (w) =>
    w.survivors.length >= 2 && totalFood(w) < FOOD_FIGHT_PER_COLONIST * w.survivors.length,
  happen(w) {
    for (const [a, b] of orderedPairs(w)) changeOpinion(a, b.id, -FOOD_FIGHT_OPINION);
    for (const s of w.survivors) addMemory(s, 'foodFight', w.tick);
    logEvent(w, { kind: 'foodFight' });
  },
};
