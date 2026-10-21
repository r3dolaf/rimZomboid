// Cuántos zombis hay y dónde aparecen (spec H4b §2.3).
import {
  ARRIVAL_GOAL_RADIUS,
  START_HOUR,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  ZOMBIE_EDGE_START_DAY,
  ZOMBIE_EVERY_HOURS,
  ZOMBIE_HEALTH,
  ZOMBIE_HOUSE_RADIUS,
  ZOMBIE_LEVEL_MULT,
  ZOMBIE_MAX,
  ZOMBIE_SAFE_RADIUS,
  ZOMBIE_START,
} from '../balance';
import { isNight } from '../clock';
import { isZombieWalkable } from '../map/grid';
import { nextFloat, nextInt } from '../rng';
import type { NarratorStyle, Point, World, Zombie, ZombieLevel } from '../types';

export function zombieStartCount(style: NarratorStyle, level: ZombieLevel): number {
  return Math.round(ZOMBIE_START[style] * ZOMBIE_LEVEL_MULT[level]);
}

export function zombieMax(style: NarratorStyle, level: ZombieLevel): number {
  return Math.round(ZOMBIE_MAX[style] * ZOMBIE_LEVEL_MULT[level]);
}

/** Tick de la primera llegada por los bordes: el día ZOMBIE_EDGE_START_DAY a las 00:00. */
export function firstEdgeArrival(): number {
  return (ZOMBIE_EDGE_START_DAY - 1) * TICKS_PER_DAY - START_HOUR * TICKS_PER_HOUR;
}

/** Un zombi nuevo, vagando, en el centro de la casilla `t`. */
export function newZombie(w: World, t: Point): Zombie {
  return {
    id: w.nextZombieId++,
    pos: { x: t.x + 0.5, y: t.y + 0.5 },
    path: [],
    health: ZOMBIE_HEALTH,
    state: 'wander',
    targetId: null,
    goal: null,
    lastSeenAt: 0,
    cooldown: 0,
    waitUntil: 0,
  };
}

function baseCenter(w: World): Point {
  const r = w.base.rect;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** ¿Puede aparecer un zombi en esa casilla? (la pisa y está lejos de la base) */
function spawnable(w: World, x: number, y: number): boolean {
  if (!isZombieWalkable(w.grid, x, y)) return false;
  const c = baseCenter(w);
  return (x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2 >= ZOMBIE_SAFE_RADIUS ** 2;
}

/**
 * Los zombis del principio: junto a una casa (las lejanas, más probables) y ninguno cerca de la
 * base. Con `zombieRng`, para no cambiar nada más del mundo.
 */
export function placeStartZombies(w: World): void {
  const rng = w.zombieRng;
  const c = baseCenter(w);
  const dist = (p: Point) => Math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2);
  const far = Math.max(1, ...w.houses.map((h) => dist(h.door)));
  const weights = w.houses.map((h) => 0.5 + dist(h.door) / far);
  const total = weights.reduce((a, b) => a + b, 0);
  const n = zombieStartCount(w.narrator.style, w.zombieLevel);
  const { width, height } = w.grid;
  for (let i = 0; i < n; i++) {
    let spot: Point | null = null;
    if (w.houses.length > 0) {
      let roll = nextFloat(rng) * total;
      let k = 0;
      while (k < weights.length - 1 && roll >= weights[k]!) roll -= weights[k++]!;
      const r = w.houses[k]!.rect;
      for (let tries = 0; tries < 30 && !spot; tries++) {
        const x = nextInt(rng, r.x - ZOMBIE_HOUSE_RADIUS, r.x + r.w - 1 + ZOMBIE_HOUSE_RADIUS);
        const y = nextInt(rng, r.y - ZOMBIE_HOUSE_RADIUS, r.y + r.h - 1 + ZOMBIE_HOUSE_RADIUS);
        if (spawnable(w, x, y)) spot = { x, y };
      }
    }
    for (let tries = 0; tries < 500 && !spot; tries++) {
      const x = nextInt(rng, 0, width - 1);
      const y = nextInt(rng, 0, height - 1);
      if (spawnable(w, x, y)) spot = { x, y };
    }
    if (spot) w.zombies.push(newZombie(w, spot));
  }
}

/** Ticks hasta la siguiente llegada por los bordes: según narrador y opción, la mitad de noche. */
export function arrivalInterval(w: World): number {
  const every =
    (ZOMBIE_EVERY_HOURS[w.narrator.style] * TICKS_PER_HOUR) / ZOMBIE_LEVEL_MULT[w.zombieLevel];
  return isNight(w.tick) ? every / 2 : every;
}

/**
 * Llega un zombi por un borde cuando toca (sin pasar del máximo) y va hacia una casa al azar, para
 * meterse en el pueblo. (Hacia el centro no: ahí está la base, y se llenaba de zombis.)
 */
export function arrivalsSystem(w: World): void {
  if (w.tick < w.nextZombieAt) return;
  w.nextZombieAt = w.tick + arrivalInterval(w);
  if (w.zombies.length >= zombieMax(w.narrator.style, w.zombieLevel)) return;
  const rng = w.zombieRng;
  const { width, height } = w.grid;
  for (let tries = 0; tries < 50; tries++) {
    const side = nextInt(rng, 0, 3);
    const along = nextInt(rng, 0, (side < 2 ? width : height) - 1);
    const x = side === 0 ? along : side === 1 ? along : side === 2 ? 0 : width - 1;
    const y = side === 0 ? 0 : side === 1 ? height - 1 : along;
    if (!isZombieWalkable(w.grid, x, y)) continue;
    const z = newZombie(w, { x, y });
    const house = w.houses.length > 0 ? w.houses[nextInt(rng, 0, w.houses.length - 1)]! : null;
    const centre = house ? house.door : { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    for (let k = 0; k < 20; k++) {
      const gx = centre.x + nextInt(rng, -ARRIVAL_GOAL_RADIUS, ARRIVAL_GOAL_RADIUS);
      const gy = centre.y + nextInt(rng, -ARRIVAL_GOAL_RADIUS, ARRIVAL_GOAL_RADIUS);
      if (!isZombieWalkable(w.grid, gx, gy)) continue;
      z.state = 'alert';
      z.goal = { x: gx, y: gy };
      break;
    }
    w.zombies.push(z);
    return;
  }
}
