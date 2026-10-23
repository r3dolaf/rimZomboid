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
  WAKE_RANGE,
} from './balance';
import { baseFloor } from './base';
import { isNight } from './clock';
import { findConsoleTarget, inCrisis as crisisNow, stillConsoling } from './consoling';
import { dangerDecision, zombieInSight } from './danger';
import { logEvent } from './log';
import { nextFloat, pick } from './rng';
import { equipFromPack } from './jobs/weapons';
import { findWork, isWorking, stillWorthIt } from './work';
import { selfCare } from './jobs/medical';
import type { Action, BrainId, Survivor, World } from './types';

/**
 * Decide la siguiente acción de un superviviente, o `null` para seguir con la actual.
 * Intercambiable: IA ahora, jugador en la fase 2.
 */
export interface Brain {
  decide(s: Survivor, w: World): Action | null;
}

/** Prioridades del spec §8.1: peligro, comer, dormir, crisis, consolar, trabajo, pasear. */
const AiBrain: Brain = {
  decide(s, w) {
    equipFromPack(s, w.chopMarks.length > 0);
    // Peligro (spec H4b §7): lo primero de todo.
    const danger = dangerDecision(s, w, () => rest(s, w));
    if (danger !== undefined) return danger;
    // Vendarse lo que sangra (H5 §4): lo siguiente, antes de comer o dormir.
    const care = selfCare(s, w);
    if (care !== undefined) return care;
    const a = s.action;
    const goingTo = a.type === 'moveTo' ? a.then?.type : undefined;
    const inCrisis = crisisNow(s);

    // Si la comida se acaba mientras va a comer o come, lo deja.
    if (((a.type === 'eat' && !a.fromPack) || goingTo === 'eat') && w.storage.items.food === 0)
      return { type: 'idle', ticksLeft: 0 };
    // Comer, dormir y pelear se terminan; la crisis solo se corta por algo urgente.
    if (a.type === 'eat' || a.type === 'sleep' || goingTo === 'eat' || goingTo === 'sleep')
      return null;
    // Pelear y consolar son cosas de dos y duran poco: las termina activitiesSystem.
    if (a.type === 'fight' || a.type === 'console' || a.type === 'consoled') return null;
    // (desplomarse, que también la corta, lo decide decisionsSystem)
    if (inCrisis) {
      if (s.needs.hunger < CRISIS_BREAK_HUNGER) return eatSomething(s, w);
      return null;
    }

    const r = rest(s, w);
    if (r) return r;
    if (crisisDue(s, w))
      return { type: 'moveTo', target: pick(w.rng, baseFloor(w)), then: { type: 'crisis' } };
    if (a.type === 'moveTo' && a.then?.type === 'console')
      return stillConsoling(s, w, a.then.otherId) ? null : { type: 'idle', ticksLeft: 0 };

    // Trabajo en curso: sigue salvo que haya dejado de tener sentido.
    if (isWorking(s)) return stillWorthIt(s, w) ? null : { type: 'idle', ticksLeft: 0 };
    // Tras negarse a trabajar espera; solo le sacan de ahí las urgencias (arriba).
    if (a.type === 'idle' && a.wait === 'refused' && a.ticksLeft > 0) return null;

    const sad = findConsoleTarget(s, w);
    if (sad)
      return {
        type: 'moveTo',
        target: { x: Math.floor(sad.pos.x), y: Math.floor(sad.pos.y) },
        then: { type: 'console', otherId: sad.id },
      };

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

/**
 * ¿Le toca una crisis? Con el ánimo bajo el umbral, salvo que se haya calmado hace poco: tras
 * desahogarse (o ser consolado) el ánimo tarda en subir, y sin esta guarda encadenaría otra.
 */
export function crisisDue(s: Survivor, w: World): boolean {
  const calmed = s.memories.some(
    (m) =>
      (m.id === 'vented' || m.id === 'consoled' || m.id === 'consoledByPartner') &&
      m.expiresAt > w.tick,
  );
  return s.needs.mood < MOOD_CRISIS && !calmed;
}

/** Comer si tiene hambre (y hay qué) o, si no, dormir si tiene sueño. */
function rest(s: Survivor, w: World): Action | null {
  if (s.needs.hunger < EAT_BELOW) {
    const eat = eatSomething(s, w);
    if (eat) return eat;
  }
  return wantsToSleep(s, w) ? goSleep(s, w) : null;
}

function wantsToSleep(s: Survivor, w: World): boolean {
  const limit = isNight(w.tick) ? SLEEP_AT_NIGHT_BELOW : SLEEP_ANYTIME_BELOW;
  // Viendo un zombi tan cerca que le despertaría, no se acuesta.
  return s.needs.sleep < limit && !zombieInSight(w, s, WAKE_RANGE);
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

export const brains: Record<BrainId, Brain> = { ai: AiBrain };
