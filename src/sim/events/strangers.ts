// Suceso 10, Desconocidos (spec H3c §3.3): llegan uno o dos (en pareja) y el jugador decide.
import {
  COLONY_MAX,
  STRANGER_FIRST_TICK,
  STRANGER_PAIR_CHANCE,
  STRANGER_PAIR_OPINION_MAX,
  STRANGER_PAIR_OPINION_MIN,
} from '../balance';
import { addDecision } from '../decisions';
import { logEvent } from '../log';
import { nextFloat, nextInt, pick } from '../rng';
import { freeNames, newStranger, roadEnds } from '../systems/strangers';
import type { GameEvent } from './types';

export const strangersEvent: GameEvent = {
  id: 'strangers',
  tone: 'mixed',
  cooldownDays: 3,
  canHappen: (w) =>
    w.tick >= STRANGER_FIRST_TICK &&
    w.stranger === null &&
    w.survivors.length < COLONY_MAX &&
    freeNames(w).length > 0 &&
    roadEnds(w).length > 0,
  happen(w) {
    const start = pick(w.rng, roadEnds(w));
    const pair =
      nextFloat(w.rng) < STRANGER_PAIR_CHANCE &&
      w.survivors.length + 2 <= COLONY_MAX &&
      freeNames(w).length >= 2;
    const a = newStranger(w, start);
    w.stranger = { survivors: [a], leaving: false };
    if (pair) {
      const b = newStranger(w, start);
      w.stranger.survivors.push(b);
      a.partnerId = b.id;
      b.partnerId = a.id;
      a.opinions[b.id] = nextInt(w.rng, STRANGER_PAIR_OPINION_MIN, STRANGER_PAIR_OPINION_MAX);
      b.opinions[a.id] = nextInt(w.rng, STRANGER_PAIR_OPINION_MIN, STRANGER_PAIR_OPINION_MAX);
    }
    const ss = w.stranger.survivors;
    addDecision(
      w,
      'stranger',
      ss.map((s) => s.id),
    );
    logEvent(w, { kind: 'strangerArrived', names: ss.map((s) => s.name) });
  },
};
