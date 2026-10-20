// Suceso 7, Noche de historias (spec H3c §3.2): sale bien… salvo con rivales o alguien al límite.
import {
  MOOD_EDGE,
  RIVAL_OPINION,
  STORY_NIGHT_ARGUE_OPINION,
  STORY_NIGHT_FROM_HOUR,
  STORY_NIGHT_OPINION,
  STORY_NIGHT_RUIN_CHANCE,
  STORY_NIGHT_TO_HOUR,
} from '../balance';
import { gameTime } from '../clock';
import { contains } from '../geom';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { nextFloat } from '../rng';
import { changeOpinion, isAvailable, opinionOf } from '../social';
import type { Survivor, World } from '../types';
import { tileOf } from '../world';
import type { GameEvent } from './types';

/** Los que pueden estar: disponibles y dentro de la base. */
function participants(w: World): Survivor[] {
  return w.survivors.filter((s) => isAvailable(s) && contains(w.base.rect, tileOf(s.pos)));
}

/** Los dos que pueden acabar discutiendo: los peores rivales, o el que está al límite y quien peor le cae. */
function troublemakers(ps: Survivor[]): [Survivor, Survivor] | null {
  let worst: [Survivor, Survivor] | null = null;
  for (const a of ps)
    for (const b of ps)
      if (a !== b && opinionOf(a, b.id) <= RIVAL_OPINION)
        if (!worst || opinionOf(a, b.id) < opinionOf(worst[0], worst[1].id)) worst = [a, b];
  if (worst) return worst;
  const edge = ps.find((s) => s.needs.mood < MOOD_EDGE);
  if (!edge) return null;
  let other = ps.find((s) => s !== edge)!;
  for (const s of ps)
    if (s !== edge && opinionOf(edge, s.id) < opinionOf(edge, other.id)) other = s;
  return [edge, other];
}

export const storyNightEvent: GameEvent = {
  id: 'storyNight',
  tone: 'good',
  cooldownDays: 3,
  canHappen(w) {
    const h = gameTime(w.tick).hour;
    return h >= STORY_NIGHT_FROM_HOUR && h < STORY_NIGHT_TO_HOUR && participants(w).length >= 2;
  },
  happen(w) {
    const ps = participants(w);
    const trouble = troublemakers(ps);
    const ruined = trouble !== null && nextFloat(w.rng) < STORY_NIGHT_RUIN_CHANCE ? trouble : null;
    const happy = ruined ? ps.filter((s) => !ruined.includes(s)) : ps;
    for (const s of happy) {
      addMemory(s, 'storyNight', w.tick);
      for (const o of happy) if (o !== s) changeOpinion(s, o.id, STORY_NIGHT_OPINION);
    }
    if (ruined) {
      const [a, b] = ruined;
      changeOpinion(a, b.id, -STORY_NIGHT_ARGUE_OPINION);
      changeOpinion(b, a.id, -STORY_NIGHT_ARGUE_OPINION);
      addMemory(a, 'argued', w.tick, b.id);
      addMemory(b, 'argued', w.tick, a.id);
    }
    logEvent(w, { kind: 'storyNight', arguedIds: ruined ? [ruined[0].id, ruined[1].id] : null });
  },
};
