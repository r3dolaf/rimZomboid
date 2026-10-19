import {
  CRISIS_BREAK_HUNGER,
  CRISIS_BREAK_SLEEP,
  EAT_BELOW,
  MOOD_CRISIS,
  SLEEP_ANYTIME_BELOW,
  SLEEP_AT_NIGHT_BELOW,
} from './balance';
import { isNight } from './clock';
import { getTile } from './map/grid';
import { pick } from './rng';
import { Tile, type Action, type BrainId, type Point, type Survivor, type World } from './types';

/**
 * Decide la siguiente acción de un superviviente, o `null` para seguir con la actual.
 * Intercambiable: IA ahora, jugador en la fase 2.
 */
export interface Brain {
  decide(s: Survivor, w: World): Action | null;
}

/** Prioridades del spec §8.1 sin peligro (H4) ni trabajo (H3): comer, dormir, crisis, pasear. */
const AiBrain: Brain = {
  decide(s, w) {
    const a = s.action;
    const goingTo = a.type === 'moveTo' ? a.then?.type : undefined;
    const inCrisis = a.type === 'crisis' || goingTo === 'crisis';

    // Comer y dormir se terminan; la crisis solo se corta por algo urgente.
    if (a.type === 'eat' || a.type === 'sleep' || goingTo === 'eat' || goingTo === 'sleep')
      return null;
    if (inCrisis) {
      if (s.needs.hunger < CRISIS_BREAK_HUNGER && w.storage.food > 0) return goEat(w);
      if (s.needs.sleep < CRISIS_BREAK_SLEEP) return goSleep(s, w);
      return null;
    }

    if (s.needs.hunger < EAT_BELOW && w.storage.food > 0) return goEat(w);
    if (wantsToSleep(s, w)) return goSleep(s, w);
    if (s.needs.mood < MOOD_CRISIS)
      return { type: 'moveTo', target: pick(w.rng, baseFloor(w)), then: { type: 'crisis' } };
    if (a.type === 'idle' && a.ticksLeft === 0)
      return { type: 'moveTo', target: pick(w.rng, baseFloor(w)) };
    return null;
  },
};

function wantsToSleep(s: Survivor, w: World): boolean {
  const limit = isNight(w.tick) ? SLEEP_AT_NIGHT_BELOW : SLEEP_ANYTIME_BELOW;
  return s.needs.sleep < limit;
}

function goEat(w: World): Action {
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'eat' } };
}

function goSleep(s: Survivor, w: World): Action {
  const bed = w.beds.find((b) => b.id === s.bedId);
  if (!bed) throw new Error(`${s.name} no tiene cama`);
  return { type: 'moveTo', target: bed.pos, then: { type: 'sleep' } };
}

function baseFloor(w: World): Point[] {
  const { x, y, w: width, h } = w.base.rect;
  const out: Point[] = [];
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + width; i++)
      if (getTile(w.grid, i, j) === Tile.Floor) out.push({ x: i, y: j });
  return out;
}

export const brains: Record<BrainId, Brain> = { ai: AiBrain };
