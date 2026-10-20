// Suceso 6, Chisme (spec H3c §3.1): A le cuenta a B cosas de C.
import { GOSSIP_FOUND_CHANCE, GOSSIP_FOUND_OPINION, GOSSIP_OPINION } from '../balance';
import { logEvent } from '../log';
import { nextFloat, pick, weightedPick } from '../rng';
import { changeOpinion, opinionOf } from '../social';
import type { GameEvent } from './types';

export const gossipEvent: GameEvent = {
  id: 'gossip',
  tone: 'bad',
  severity: 1,
  cooldownDays: 3,
  canHappen: (w) => w.survivors.length >= 3,
  happen(w) {
    const ss = w.survivors;
    const weights: Record<string, number> = {};
    ss.forEach((s, i) => (weights[i] = s.traits.includes('pessimist') ? 2 : 1));
    const a = ss[Number(weightedPick(w.rng, weights))]!;
    // La víctima: quien peor le cae al chismoso (a igualdad, el primero de la lista).
    let c = ss.find((s) => s !== a)!;
    for (const s of ss) if (s !== a && opinionOf(a, s.id) < opinionOf(a, c.id)) c = s;
    const b = pick(
      w.rng,
      ss.filter((s) => s !== a && s !== c),
    );
    changeOpinion(b, c.id, -GOSSIP_OPINION);
    const found = nextFloat(w.rng) < GOSSIP_FOUND_CHANCE;
    if (found) changeOpinion(c, a.id, -GOSSIP_FOUND_OPINION);
    logEvent(w, { kind: 'gossip', survivorId: a.id, listenerId: b.id, otherId: c.id, found });
  },
};
