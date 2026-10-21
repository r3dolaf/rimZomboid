// La capa de Peligro del cerebro (spec H4b §7): pelear o huir según la postura.
import {
  ALLY_RANGE,
  DANGER_RANGE,
  DECIDE_MAX_THREATS,
  DECIDE_MIN_HEALTH,
  FLEE_HEALTH,
  SHELTER_WAIT_TICKS,
  SURVIVOR_REACH,
  UNARMED_MAX_THREATS,
  UNARMED_MIN_HEALTH,
  WAKE_RANGE,
} from './balance';
import { baseFloor } from './base';
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

/** Zombis que ve ahora algún colono (para el HUD y el mapa). */
export function zombiesInSight(w: World): Zombie[] {
  return w.zombies.filter((z) =>
    w.survivors.some((s) => {
      const range = visionFor(w, s);
      return d2(z.pos, s.pos) <= range * range && lineOfSight(w.grid, tileOf(s.pos), tileOf(z.pos));
    }),
  );
}

/** ¿Hay un zombi a `range` casillas o menos (lo oiga o no lo vea)? */
export function zombieNear(w: World, s: Survivor, range: number): boolean {
  return w.zombies.some((z) => d2(z.pos, s.pos) <= range * range);
}

/** ¿Pelea o huye? (spec H4b §7) */
function willFight(w: World, s: Survivor, threats: Zombie[]): boolean {
  if (s.health < FLEE_HEALTH) return false;
  if (s.stance === 'fight') return true;
  if (s.stance === 'flee') return false;
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

/**
 * La capa de Peligro: `undefined` si no hay peligro (decide el resto del cerebro); si no, lo que
 * hace (o `null` para seguir con lo que hacía).
 */
export function dangerDecision(s: Survivor, w: World): Action | null | undefined {
  const a = s.action;
  if (a.type === 'downed') return undefined;
  if (a.type === 'sleep' && !zombieNear(w, s, WAKE_RANGE)) return undefined;
  const threats = threatsOf(w, s);
  if (threats.length === 0) {
    // Se despierta (lo ha oído) o deja de pelear cuando no ve a ninguno.
    if (a.type === 'sleep' || a.type === 'melee') return { type: 'idle', ticksLeft: 0 };
    return undefined;
  }
  if (willFight(w, s, threats)) return melee(s, threats[0]!);

  // Huye. Acorralado (ya en la base o sin camino): pelea con el que tenga al lado.
  const near = threats.find((z) => d2(z.pos, s.pos) <= SURVIVOR_REACH * SURVIVOR_REACH);
  const inBase = contains(w.base.rect, tileOf(s.pos));
  const target = shelter(w, threats);
  const here = tileOf(s.pos);
  const reachable =
    target && regionOf(w.grid, here.x, here.y) === regionOf(w.grid, target.x, target.y);
  if (inBase || !reachable) {
    if (near) return melee(s, near);
    // En la base: se queda dentro, lejos de la ventana, sin trabajar.
    if (a.type === 'moveTo' && !a.then && contains(w.base.rect, a.target)) return null;
    if (a.type === 'idle' && a.ticksLeft > 0) return null;
    if (inBase && target) return { type: 'moveTo', target };
    return { type: 'idle', ticksLeft: SHELTER_WAIT_TICKS };
  }
  if (a.type === 'moveTo' && a.run && !a.then && contains(w.base.rect, a.target)) return null;
  logEvent(w, { kind: 'fled', survivorId: s.id });
  return { type: 'moveTo', target: target!, run: true };
}
