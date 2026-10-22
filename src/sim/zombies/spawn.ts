// Cuántos zombis hay y dónde aparecen (spec H4b §2.3).
import {
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
  ZOMBIE_TOWN_SHARE,
  TRAPPED,
  TRAPPED_HOUSE_CHANCE,
} from '../balance';
import { contains, intersects } from '../geom';
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
 * Los zombis del principio (spec H4f §5): primero los encerrados en los edificios grandes (como
 * mucho la mitad), luego, de los demás, 7 de cada 10 por las calles del pueblo y el resto en el
 * campo, junto a los edificios sueltos; ninguno cerca de la base. Con `zombieRng`, para no cambiar
 * nada más del mundo.
 */
export function placeStartZombies(w: World): void {
  const rng = w.zombieRng;
  const n = zombieStartCount(w.narrator.style, w.zombieLevel);
  const inBuilding = (x: number, y: number) =>
    w.houses.some((h) => contains(h.rect, { x, y })) || contains(w.base.rect, { x, y });
  // Encerrados: en el suelo de su edificio, si queda lejos de la base.
  let trapped = 0;
  for (const h of w.houses) {
    const range = h.kind in TRAPPED ? TRAPPED[h.kind as keyof typeof TRAPPED] : null;
    let want =
      range !== null
        ? nextInt(rng, range[0], range[1])
        : h.kind === 'house' && nextFloat(rng) < TRAPPED_HOUSE_CHANCE
          ? 1
          : 0;
    want = Math.min(want, Math.floor(n / 2) - trapped);
    for (let k = 0; k < want; k++) {
      const spot = tryFind(30, () => {
        const x = nextInt(rng, h.rect.x + 1, h.rect.x + h.rect.w - 2);
        const y = nextInt(rng, h.rect.y + 1, h.rect.y + h.rect.h - 2);
        return spawnable(w, x, y) ? { x, y } : null;
      });
      if (!spot) break;
      w.zombies.push(newZombie(w, spot));
      trapped++;
    }
  }
  // Los de fuera: por las calles del pueblo o junto a los edificios sueltos.
  const rest = n - trapped;
  const town = Math.round(rest * ZOMBIE_TOWN_SHARE);
  const loose = w.houses.filter((h) => !intersects(h.rect, w.town));
  const { width, height } = w.grid;
  for (let i = 0; i < rest; i++) {
    const outside = (x: number, y: number) => spawnable(w, x, y) && !inBuilding(x, y);
    let spot: Point | null = null;
    if (i < town)
      spot = tryFind(50, () => {
        const x = nextInt(rng, w.town.x, w.town.x + w.town.w - 1);
        const y = nextInt(rng, w.town.y, w.town.y + w.town.h - 1);
        return outside(x, y) ? { x, y } : null;
      });
    else if (loose.length > 0) {
      const r = loose[nextInt(rng, 0, loose.length - 1)]!.rect;
      spot = tryFind(30, () => {
        const x = nextInt(rng, r.x - ZOMBIE_HOUSE_RADIUS, r.x + r.w - 1 + ZOMBIE_HOUSE_RADIUS);
        const y = nextInt(rng, r.y - ZOMBIE_HOUSE_RADIUS, r.y + r.h - 1 + ZOMBIE_HOUSE_RADIUS);
        return outside(x, y) ? { x, y } : null;
      });
    }
    spot ??= tryFind(500, () => {
      const x = nextInt(rng, 0, width - 1);
      const y = nextInt(rng, 0, height - 1);
      return outside(x, y) ? { x, y } : null;
    });
    if (spot) w.zombies.push(newZombie(w, spot));
  }
}

/** Prueba `f` hasta `tries` veces; la primera casilla que devuelve, o `null`. */
function tryFind(tries: number, f: () => Point | null): Point | null {
  for (let k = 0; k < tries; k++) {
    const p = f();
    if (p) return p;
  }
  return null;
}

/** Ticks hasta la siguiente llegada por los bordes: según narrador y opción, la mitad de noche. */
export function arrivalInterval(w: World): number {
  const every =
    (ZOMBIE_EVERY_HOURS[w.narrator.style] * TICKS_PER_HOUR) / ZOMBIE_LEVEL_MULT[w.zombieLevel];
  return isNight(w.tick) ? every / 2 : every;
}

/**
 * Llega un zombi por un borde cuando toca (sin pasar del máximo) y va hacia el pueblo (H4f).
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
    // Van hacia una casilla del pueblo (H4f; antes, hacia una casa al azar).
    for (let k = 0; k < 20; k++) {
      const gx = nextInt(rng, w.town.x, w.town.x + w.town.w - 1);
      const gy = nextInt(rng, w.town.y, w.town.y + w.town.h - 1);
      if (!isZombieWalkable(w.grid, gx, gy)) continue;
      z.state = 'alert';
      z.goal = { x: gx, y: gy };
      break;
    }
    w.zombies.push(z);
    return;
  }
}
