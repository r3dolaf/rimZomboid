import {
  CRISIS_BREAK_HUNGER,
  EAT_TICKS,
  EAT_BELOW,
  MOOD_CRISIS,
  MOOD_EDGE,
  REFUSE_CHANCE,
  REFUSE_TICKS,
  SLEEP_ANYTIME_BELOW,
  SLEEP_AT_NIGHT_BELOW,
} from './balance';
import { isNight } from './clock';
import { getTile } from './map/grid';
import { logEvent } from './log';
import { nextFloat, pick } from './rng';
import { findWork, stillWorthIt } from './work';
import { Tile, type Action, type BrainId, type Point, type Survivor, type World } from './types';

/**
 * Decide la siguiente acción de un superviviente, o `null` para seguir con la actual.
 * Intercambiable: IA ahora, jugador en la fase 2.
 */
export interface Brain {
  decide(s: Survivor, w: World): Action | null;
}

/** Prioridades del spec §8.1 sin peligro (H4): comer, dormir, crisis, trabajo, pasear. */
const AiBrain: Brain = {
  decide(s, w) {
    const a = s.action;
    const goingTo = a.type === 'moveTo' ? a.then?.type : undefined;
    const inCrisis = a.type === 'crisis' || goingTo === 'crisis';

    // Si la comida se acaba mientras va a comer o come, lo deja.
    if (((a.type === 'eat' && !a.fromPack) || goingTo === 'eat') && w.storage.items.food === 0)
      return { type: 'idle', ticksLeft: 0 };
    // Comer y dormir se terminan; la crisis solo se corta por algo urgente.
    if (a.type === 'eat' || a.type === 'sleep' || goingTo === 'eat' || goingTo === 'sleep')
      return null;
    // (desplomarse, que también la corta, lo decide decisionsSystem)
    if (inCrisis) {
      if (s.needs.hunger < CRISIS_BREAK_HUNGER) return eatSomething(s, w);
      return null;
    }

    if (s.needs.hunger < EAT_BELOW) {
      const eat = eatSomething(s, w);
      if (eat) return eat;
    }
    if (wantsToSleep(s, w)) return goSleep(s, w);
    // Tras desahogarse el ánimo tarda en subir: sin esta guarda, encadenaría otra crisis al momento.
    const vented = s.memories.some((m) => m.id === 'vented' && m.expiresAt > w.tick);
    if (s.needs.mood < MOOD_CRISIS && !vented)
      return { type: 'moveTo', target: pick(w.rng, baseFloor(w)), then: { type: 'crisis' } };

    // Trabajo en curso: sigue salvo que haya dejado de tener sentido.
    const working =
      a.type === 'search' || a.type === 'unload' || goingTo === 'search' || goingTo === 'unload';
    if (working) return stillWorthIt(s, w) ? null : { type: 'idle', ticksLeft: 0 };
    // Tras negarse a trabajar espera; solo le sacan de ahí las urgencias (arriba).
    if (a.type === 'idle' && a.wait === 'refused' && a.ticksLeft > 0) return null;

    const job = findWork(s, w);
    if (job) {
      if (s.needs.mood < MOOD_EDGE && nextFloat(w.rng) < REFUSE_CHANCE) {
        logEvent(w, { kind: 'refused', survivorId: s.id });
        return { type: 'idle', ticksLeft: REFUSE_TICKS, wait: 'refused' };
      }
      return job;
    }
    if (a.type === 'idle' && a.ticksLeft === 0)
      return { type: 'moveTo', target: pick(w.rng, baseFloor(w)) };
    return null;
  },
};

function wantsToSleep(s: Survivor, w: World): boolean {
  const limit = isNight(w.tick) ? SLEEP_AT_NIGHT_BELOW : SLEEP_ANYTIME_BELOW;
  return s.needs.sleep < limit;
}

/** Come de lo que lleva encima si puede; si no, va al almacén si queda comida. */
function eatSomething(s: Survivor, w: World): Action | null {
  if (s.carrying.food > 0) return { type: 'eat', ticksLeft: EAT_TICKS, fromPack: true };
  if (w.storage.items.food > 0) return goEat(w);
  return null;
}

function goEat(w: World): Action {
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'eat' } };
}

/** A su cama; si no tiene, a cualquier sitio del suelo de la base. */
function goSleep(s: Survivor, w: World): Action {
  const bed = w.beds.find((b) => b.id === s.bedId);
  const target = bed ? bed.pos : pick(w.rng, baseFloor(w));
  return { type: 'moveTo', target, then: { type: 'sleep' } };
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
