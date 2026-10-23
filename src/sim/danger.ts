// La capa de Peligro del cerebro (spec H4b §7): pelear o huir según la postura.
import {
  ALLY_RANGE,
  DANGER_RANGE,
  DECIDE_MAX_THREATS,
  DECIDE_MIN_HEALTH,
  FLED_LOG_TICKS,
  FLEE_HEALTH,
  SHELTER_WAIT_TICKS,
  SURVIVOR_REACH,
  UNARMED_MAX_THREATS,
  UNARMED_MIN_HEALTH,
  WAKE_MIN_SLEEP,
  WAKE_RANGE,
} from './balance';
import { baseFloor } from './base';
import { armFactor } from './body';
import { visionFor } from './furniture';
import { contains } from './geom';
import { logEvent } from './log';
import { regionOf } from './path/astar';
import type { Action, Point, Survivor, World, Zombie } from './types';
import { lineOfSight } from './vision';
import { tileOf } from './world';

const d2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Zombis que ve: en línea recta, a la distancia de su vista o menos (y como mucho DANGER_RANGE). */
export function threatsOf(w: World, s: Survivor): Zombie[] {
  const range = Math.min(visionFor(w, s), DANGER_RANGE);
  const at = tileOf(s.pos);
  return w.zombies
    .filter((z) => d2(z.pos, s.pos) <= range * range && lineOfSight(w.grid, at, tileOf(z.pos)))
    .sort((a, b) => d2(a.pos, s.pos) - d2(b.pos, s.pos));
}

/** ¿Lo ve ahora algún colono? */
export function seenByColony(w: World, z: Zombie): boolean {
  return w.survivors.some((s) => {
    const range = visionFor(w, s);
    return d2(z.pos, s.pos) <= range * range && lineOfSight(w.grid, tileOf(s.pos), tileOf(z.pos));
  });
}

/** Zombis que ve ahora algún colono (para el HUD y el mapa). */
export function zombiesInSight(w: World): Zombie[] {
  return w.zombies.filter((z) => seenByColony(w, z));
}

/** ¿Ve un zombi a `range` casillas o menos? (Uno detrás de un muro no cuenta.) */
export function zombieInSight(w: World, s: Survivor, range: number): boolean {
  const at = tileOf(s.pos);
  return w.zombies.some(
    (z) => d2(z.pos, s.pos) <= range * range && lineOfSight(w.grid, at, tileOf(z.pos)),
  );
}

/** ¿Pelea o huye? (spec H4b §7) Los desconocidos (H4e), siempre como con Decidir. */
export function willFight(w: World, s: Survivor, threats: Zombie[], stance = s.stance): boolean {
  if (s.health < FLEE_HEALTH || armFactor(s) === 0) return false; // sin brazos (H5), huye
  if (stance === 'fight') return true;
  if (stance === 'flee') return false;
  const allies = w.survivors.filter(
    (o) => o !== s && o.action.type === 'melee' && d2(o.pos, s.pos) <= ALLY_RANGE * ALLY_RANGE,
  ).length;
  const trait = (s.traits.includes('brave') ? 1 : 0) - (s.traits.includes('coward') ? 1 : 0);
  const count = threats.length - allies;
  if (s.equipped) return s.health >= DECIDE_MIN_HEALTH && count <= DECIDE_MAX_THREATS + trait;
  return s.health >= UNARMED_MIN_HEALTH && count <= UNARMED_MAX_THREATS + trait;
}

function melee(s: Survivor, z: Zombie): Action | null {
  const a = s.action;
  if (a.type === 'melee' && a.zombieId === z.id) return null; // ya está en ello
  return { type: 'melee', zombieId: z.id, cooldown: 0 };
}

/** La casilla de suelo de la base más lejos de los zombis que ve. */
function shelter(w: World, threats: Zombie[]): Point | null {
  let best: Point | null = null;
  let bestD = -1;
  for (const p of baseFloor(w)) {
    const c = { x: p.x + 0.5, y: p.y + 0.5 };
    const d = Math.min(...threats.map((z) => d2(z.pos, c)));
    if (d > bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** ¿Va corriendo a la base? */
const fleeing = (w: World, a: Action) =>
  a.type === 'moveTo' && a.run === true && !a.then && contains(w.base.rect, a.target);

/**
 * La capa de Peligro: `undefined` si no hay peligro (decide el resto del cerebro); si no, lo que
 * hace (o `null` para seguir con lo que hacía).
 */
export function dangerDecision(
  s: Survivor,
  w: World,
  rest: () => Action | null = () => null,
): Action | null | undefined {
  const a = s.action;
  if (a.type === 'downed') return undefined;
  // Durmiendo, solo le despierta un zombi que ve muy cerca (y rendido de sueño, ni eso).
  if (a.type === 'sleep' && (s.needs.sleep < WAKE_MIN_SLEEP || !zombieInSight(w, s, WAKE_RANGE)))
    return undefined;
  const threats = threatsOf(w, s);
  if (threats.length === 0) {
    // Huyendo, sigue hasta la base aunque deje de verlo un momento (si no, iba y volvía).
    if (fleeing(w, a)) return null;
    // Deja de pelear (o de dormir) cuando no ve a ninguno.
    if (a.type === 'sleep' || a.type === 'melee') return { type: 'idle', ticksLeft: 0 };
    return undefined;
  }
  if (willFight(w, s, threats)) return melee(s, threats[0]!);
  // Lleva a un derribado (Sanar, H4e): sigue llevándolo, que ya va a la base.
  if (s.carryingId !== null) return null;

  // Huye. Acorralado (ya en la base o sin camino): pelea con el que tenga al lado.
  const near = threats.find((z) => d2(z.pos, s.pos) <= SURVIVOR_REACH * SURVIVOR_REACH);
  const inBase = contains(w.base.rect, tileOf(s.pos));
  const target = shelter(w, threats);
  const here = tileOf(s.pos);
  const reachable =
    target && regionOf(w.grid, here.x, here.y) === regionOf(w.grid, target.x, target.y);
  if (inBase || !reachable) {
    if (near) return melee(s, near);
    // En la base, sin ninguno al lado, come y duerme (si no, caían rendidos).
    if (inBase) {
      const goingTo = a.type === 'moveTo' ? a.then?.type : undefined;
      if (a.type === 'eat' || goingTo === 'eat' || goingTo === 'sleep') return null;
      const r = rest();
      if (r) return r;
    }
    // En la base: se queda dentro, lejos de la ventana, sin trabajar.
    if (a.type === 'moveTo' && !a.then && contains(w.base.rect, a.target)) return null;
    if (a.type === 'idle' && a.ticksLeft > 0) return null;
    if (inBase && target) return { type: 'moveTo', target };
    return { type: 'idle', ticksLeft: SHELTER_WAIT_TICKS };
  }
  if (fleeing(w, a)) return null;
  // Si va y vuelve (un zombi rondando la base), no llena el registro ni los avisos.
  const lately = w.log.some(
    (e) => e.kind === 'fled' && e.survivorId === s.id && w.tick - e.tick < FLED_LOG_TICKS,
  );
  if (!lately) logEvent(w, { kind: 'fled', survivorId: s.id });
  return { type: 'moveTo', target: target!, run: true };
}
