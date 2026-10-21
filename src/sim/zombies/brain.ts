// El cerebro de los zombis (spec H4b §2.2): vagar y agruparse, alertado y contagio, perseguir,
// perder el rastro y golpear. Con `zombieRng`, para no cambiar lo que hacen los colonos.
import {
  HERD_CHANCE,
  HERD_RANGE,
  LOSE_TRACK_TICKS,
  NOISE,
  BORED_TICKS,
  WANDER_FAR_MAX,
  WANDER_FAR_MIN,
  WANDER_MAX,
  WANDER_MIN,
  WANDER_PATH_BUDGET,
  WANDER_PAUSE_MAX,
  WANDER_PAUSE_MIN,
  ZOMBIE_DAMAGE_MAX,
  ZOMBIE_DAMAGE_MIN,
  ZOMBIE_HIT_CHANCE,
  ZOMBIE_HIT_TICKS,
  ZOMBIE_REPATH_TICKS,
  ZOMBIE_THINK_TICKS,
  ZOMBIE_VISION,
} from '../balance';
import { hurtSurvivor } from '../health';
import { isZombieWalkable } from '../map/grid';
import { makeNoise, visibleCampfire } from '../noise';
import { findCostPath } from '../path/astar';
import { nextFloat, nextInt } from '../rng';
import type { Point, Survivor, World, Zombie } from '../types';
import { lineOfSight } from '../vision';
import { tileOf } from '../world';
import { zombiePath, zombieStepCost } from './path';

/** ¿Ve el zombi esa posición? (a ZOMBIE_VISION casillas o menos, en línea recta) */
export function zombieSees(w: World, z: Zombie, p: Point): boolean {
  const d2 = (p.x - z.pos.x) ** 2 + (p.y - z.pos.y) ** 2;
  return d2 <= ZOMBIE_VISION * ZOMBIE_VISION && lineOfSight(w.grid, tileOf(z.pos), tileOf(p));
}

/** ¿Lo puede ver un zombi? Los derribados, no (spec H4b §5). */
export const visibleToZombies = (s: Survivor) => s.action.type !== 'downed';

/** El colono más cercano que ve, o `null`. */
function preyInSight(w: World, z: Zombie): Survivor | null {
  let best: Survivor | null = null;
  let bestD = Infinity;
  for (const s of w.survivors) {
    if (!visibleToZombies(s)) continue;
    const d = (s.pos.x - z.pos.x) ** 2 + (s.pos.y - z.pos.y) ** 2;
    if (d < bestD && zombieSees(w, z, s.pos)) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

const same = (a: Point | null, b: Point) => a !== null && a.x === b.x && a.y === b.y;

/** Camino hacia `goal` (rompiendo lo que haga falta); si no hay, un paso en línea recta. */
function planTo(w: World, z: Zombie, goal: Point): void {
  z.path = zombiePath(w, tileOf(z.pos), goal) ?? stepToward(w, z, goal);
}

/** La casilla de al lado que más le acerca a `goal`, si alguna le acerca. */
function stepToward(w: World, z: Zombie, goal: Point): Point[] {
  const at = tileOf(z.pos);
  const d = (p: Point) => (p.x - goal.x) ** 2 + (p.y - goal.y) ** 2;
  let best: Point | null = null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const p = { x: at.x + dx, y: at.y + dy };
      // En diagonal, solo por lo libre y sin cortar esquinas (como en los caminos).
      const cost = zombieStepCost(w, p.x, p.y);
      const diagonal = dx !== 0 && dy !== 0;
      const free = (x: number, y: number) => zombieStepCost(w, x, y) === 1;
      if (diagonal && !(cost === 1 && free(at.x + dx, at.y) && free(at.x, at.y + dy))) continue;
      if ((dx || dy) && cost < Infinity && d(p) < d(best ?? at)) best = p;
    }
  return best ? [best] : [];
}

function alertTo(w: World, z: Zombie, goal: Point): void {
  if (z.state === 'alert' && same(z.goal, goal)) return;
  z.lastSeenAt = w.tick;
  z.state = 'alert';
  z.targetId = null;
  z.goal = { ...goal };
  z.path = [];
}

function startWandering(w: World, z: Zombie): void {
  z.state = 'wander';
  z.targetId = null;
  z.goal = null;
  z.path = [];
  z.waitUntil = w.tick + nextInt(w.zombieRng, WANDER_PAUSE_MIN, WANDER_PAUSE_MAX);
}

/** Decide qué hace el zombi. Lo llama `zombieSystem` cada ZOMBIE_THINK_TICKS. */
export function thinkZombie(w: World, z: Zombie): void {
  // Perseguir a quien ve.
  const prey = preyInSight(w, z);
  if (prey) {
    const t = tileOf(prey.pos);
    const moved = !same(z.goal, t);
    z.state = 'chase';
    z.targetId = prey.id;
    z.lastSeenAt = w.tick;
    z.goal = t;
    const due = (w.tick + z.id) % ZOMBIE_REPATH_TICKS < ZOMBIE_THINK_TICKS;
    if (moved || z.path.length === 0 || due) planTo(w, z, t);
    return;
  }
  if (z.state === 'chase') {
    const target = w.survivors.find((s) => s.id === z.targetId);
    // Al derribado lo deja; a quien deja de ver, lo busca donde lo vio un rato.
    if (!target || !visibleToZombies(target)) return startWandering(w, z);
    if (w.tick - z.lastSeenAt < LOSE_TRACK_TICKS) {
      if (z.path.length === 0 && z.goal) planTo(w, z, z.goal);
      return;
    }
    alertTo(w, z, z.goal ?? tileOf(z.pos));
  }
  // Contagio: va adonde otro zombi que ve está persiguiendo a alguien.
  for (const o of w.zombies)
    if (o !== z && o.state === 'chase' && o.goal && zombieSees(w, z, o.pos)) {
      alertTo(w, z, o.goal);
      break;
    }
  // De noche, la hoguera.
  if (z.state === 'wander') {
    const fire = visibleCampfire(w, z);
    if (fire) alertTo(w, z, fire);
  }
  if (z.state === 'alert') {
    const at = tileOf(z.pos);
    if (!z.goal || same(z.goal, at)) return startWandering(w, z);
    if (z.path.length === 0) {
      planTo(w, z, z.goal);
      if (z.path.length === 0) startWandering(w, z); // no puede acercarse más
    }
    return;
  }
  wander(w, z);
}

/** Vagar: pausa, paseo corto (casi siempre hacia el grupo que tenga cerca; largo si se aburre), pausa… */
function wander(w: World, z: Zombie): void {
  if (z.path.length > 0 || w.tick < z.waitUntil) return;
  if (z.goal) {
    // Acaba de llegar de un paseo: descansa un rato.
    z.goal = null;
    z.waitUntil = w.tick + nextInt(w.zombieRng, WANDER_PAUSE_MIN, WANDER_PAUSE_MAX);
    return;
  }
  const rng = w.zombieRng;
  const at = tileOf(z.pos);
  const near = w.zombies.filter(
    (o) => o !== z && (o.pos.x - z.pos.x) ** 2 + (o.pos.y - z.pos.y) ** 2 <= HERD_RANGE ** 2,
  );
  let target: Point | null = null;
  const bored = w.tick - z.lastSeenAt > BORED_TICKS;
  if (bored) {
    // Aburrido (horas sin nada que le llame la atención): un paseo largo. Así los grupos no se
    // quedan para siempre donde perdieron a alguien (p. ej., dentro de la base).
    const angle = nextFloat(rng) * 2 * Math.PI;
    const r = nextInt(rng, WANDER_FAR_MIN, WANDER_FAR_MAX);
    target = {
      x: at.x + Math.round(Math.cos(angle) * r),
      y: at.y + Math.round(Math.sin(angle) * r),
    };
  } else if (near.length > 0 && nextFloat(rng) < HERD_CHANCE) {
    const cx = near.reduce((a, o) => a + o.pos.x, 0) / near.length;
    const cy = near.reduce((a, o) => a + o.pos.y, 0) / near.length;
    target = { x: Math.floor(cx) + nextInt(rng, -1, 1), y: Math.floor(cy) + nextInt(rng, -1, 1) };
  } else {
    const angle = nextFloat(rng) * 2 * Math.PI;
    const r = nextInt(rng, WANDER_MIN, WANDER_MAX);
    target = {
      x: at.x + Math.round(Math.cos(angle) * r),
      y: at.y + Math.round(Math.sin(angle) * r),
    };
  }
  if (!isZombieWalkable(w.grid, target.x, target.y) || same(target, at)) return;
  // Al vagar no rompe nada: solo por donde se pisa.
  const free = (x: number, y: number) => (isZombieWalkable(w.grid, x, y) ? 1 : Infinity);
  const path = findCostPath(w.grid, at, target, free, WANDER_PATH_BUDGET);
  if (!path) return;
  z.path = path;
  z.goal = target;
  if (bored) z.lastSeenAt = w.tick;
}

/** Un golpe a un colono: puede fallar; si acierta, le quita Salud. Siempre se oye. */
export function zombieAttack(w: World, z: Zombie, s: Survivor): void {
  z.cooldown = ZOMBIE_HIT_TICKS;
  if (s.action.type === 'sleep') s.action = { type: 'idle', ticksLeft: 0 }; // le despierta
  makeNoise(w, s.pos, NOISE.fightHit);
  if (nextFloat(w.zombieRng) >= ZOMBIE_HIT_CHANCE) return;
  hurtSurvivor(w, s, nextInt(w.zombieRng, ZOMBIE_DAMAGE_MIN, ZOMBIE_DAMAGE_MAX));
}
