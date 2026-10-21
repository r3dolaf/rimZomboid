// Consolar (spec H3b §4): quién lo necesita, quién puede hacerlo y qué pasa al terminar.
import {
  CONSOLE_OPINION,
  CONSOLE_OPINION_GAIN,
  CONSOLE_RANGE,
  CONSOLE_TICKS,
  MOOD_EDGE,
} from './balance';
import { logEvent } from './log';
import { addMemory } from './mood';
import { regionOf } from './path/astar';
import { changeOpinion, opinionOf } from './social';
import type { Survivor, World } from './types';

export function inCrisis(s: Survivor): boolean {
  const a = s.action;
  return a.type === 'crisis' || (a.type === 'moveTo' && a.then?.type === 'crisis');
}

/** A quién va a consolar o está consolando, o `null`. */
export function consolingTargetId(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'console') return a.otherId;
  if (a.type === 'moveTo' && a.then?.type === 'console') return a.then.otherId;
  return null;
}

/** En crisis o al límite, despierto, sin pelear, no en el suelo y sin un "Consolado" vigente. */
export function needsConsoling(t: Survivor, w: World): boolean {
  const a = t.action.type;
  if (a === 'sleep' || a === 'fight' || a === 'console') return false;
  if (a === 'downed' || a === 'melee') return false;
  if (!inCrisis(t) && t.needs.mood >= MOOD_EDGE) return false;
  return !t.memories.some(
    (m) => (m.id === 'consoled' || m.id === 'consoledByPartner') && m.expiresAt > w.tick,
  );
}

/** ¿Puede `c` consolar a `t`? Bien de ánimo y con buena opinión de él (o es su pareja). */
export function canConsole(c: Survivor, t: Survivor): boolean {
  // Consolar es el trabajo Social (H4a): sin permiso, no consuela.
  if (!c.work.social || c === t || inCrisis(c) || c.needs.mood < MOOD_EDGE) return false;
  return c.partnerId === t.id || opinionOf(c, t.id) >= CONSOLE_OPINION;
}

/** ¿Hay otro (que no sea `c`) yendo a consolarle o consolándole? */
function claimed(w: World, t: Survivor, c: Survivor): boolean {
  return w.survivors.some((x) => x !== c && consolingTargetId(x) === t.id);
}

/** El más cercano al que `c` puede ir a consolar, o `null`. */
export function findConsoleTarget(c: Survivor, w: World): Survivor | null {
  const cx = Math.floor(c.pos.x);
  const cy = Math.floor(c.pos.y);
  const region = regionOf(w.grid, cx, cy);
  let best: Survivor | null = null;
  let bestD = Infinity;
  for (const t of w.survivors) {
    if (!canConsole(c, t) || !needsConsoling(t, w) || claimed(w, t, c)) continue;
    const tx = Math.floor(t.pos.x);
    const ty = Math.floor(t.pos.y);
    if (regionOf(w.grid, tx, ty) !== region) continue;
    const d = (tx - cx) ** 2 + (ty - cy) ** 2;
    if (d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

/** Mientras va: ¿sigue teniendo sentido ir a consolar a `targetId`? */
export function stillConsoling(c: Survivor, w: World, targetId: number): boolean {
  const t = w.survivors.find((x) => x.id === targetId);
  return t !== undefined && canConsole(c, t) && needsConsoling(t, w) && !claimed(w, t, c);
}

/**
 * Al llegar: si el otro sigue necesitándolo, está a CONSOLE_RANGE o menos y no está ocupado
 * comiendo, empiezan los dos. Devuelve si ha empezado.
 */
export function tryStartConsoling(w: World, c: Survivor, targetId: number): boolean {
  const t = w.survivors.find((x) => x.id === targetId);
  if (!t || !stillConsoling(c, w, targetId) || t.action.type === 'eat') return false;
  const dx = Math.floor(t.pos.x) - Math.floor(c.pos.x);
  const dy = Math.floor(t.pos.y) - Math.floor(c.pos.y);
  if (dx * dx + dy * dy > CONSOLE_RANGE * CONSOLE_RANGE) return false;
  c.action = { type: 'console', otherId: t.id, ticksLeft: CONSOLE_TICKS };
  c.path = [];
  t.action = { type: 'consoled', otherId: c.id };
  t.path = [];
  for (const s of [c, t]) s.bubble = { kind: 'console', until: w.tick + CONSOLE_TICKS };
  return true;
}

/** Termina bien: "Le consoló X" (o su pareja), +CONSOLE_OPINION_GAIN de opinión los dos y al registro. */
export function finishConsoling(w: World, c: Survivor, t: Survivor): void {
  addMemory(t, c.partnerId === t.id ? 'consoledByPartner' : 'consoled', w.tick, c.id);
  changeOpinion(c, t.id, CONSOLE_OPINION_GAIN);
  changeOpinion(t, c.id, CONSOLE_OPINION_GAIN);
  logEvent(w, { kind: 'consoled', survivorId: c.id, otherId: t.id });
  c.action = { type: 'idle', ticksLeft: 0 };
  t.action = { type: 'idle', ticksLeft: 0 };
}
