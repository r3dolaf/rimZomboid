// Las hordas del narrador (spec H4e §2): la llegada del asedio, su empeño en la base y su fin; los
// errantes que cruzan el mapa. Las posiciones, con `zombieRng`, para no cambiar el resto.
import {
  HORDE_SPAWN_DEPTH,
  HORDE_SPAWN_SPREAD,
  SIEGE_HOURS,
  SIEGE_SIZE,
  TICKS_PER_HOUR,
  ZOMBIE_LEVEL_MULT,
} from '../balance';
import { baseFloor } from '../base';
import { gameTime } from '../clock';
import { logEvent } from '../log';
import { isZombieWalkable } from '../map/grid';
import { nextInt } from '../rng';
import type { Horde, MapSide, Point, World } from '../types';
import { newZombie } from './spawn';

/** ¿Hay un asedio en marcha (llegado y sin terminar)? */
export function siegeActive(w: World): boolean {
  return w.hordes.some((h) => h.kind === 'siege' && !h.done);
}

/** Cuántos vienen en un asedio: según el narrador, +1 cada 2 días y por la opción de la portada. */
export function siegeSize(w: World): number {
  const [lo, hi] = SIEGE_SIZE[w.narrator.style];
  const day = gameTime(w.tick).day;
  return Math.round(
    (nextInt(w.rng, lo, hi) + Math.floor(day / 2)) * ZOMBIE_LEVEL_MULT[w.zombieLevel],
  );
}

/** Una casilla al azar del suelo de la base: adonde va un zombi del asedio que no ve a nadie. */
export function siegeTarget(w: World): Point {
  const floor = baseFloor(w);
  return floor.length > 0 ? floor[nextInt(w.zombieRng, 0, floor.length - 1)]! : { ...w.base.door };
}

/** La casilla a `depth` del borde `side`, en la posición `along` a lo largo de él. */
function edgeTile(w: World, side: MapSide, along: number, depth: number): Point {
  const { width, height } = w.grid;
  if (side === 0) return { x: along, y: depth };
  if (side === 1) return { x: along, y: height - 1 - depth };
  if (side === 2) return { x: depth, y: along };
  return { x: width - 1 - depth, y: along };
}

/**
 * Hace aparecer una horda de `size` zombis juntos en el borde `side` (a ±HORDE_SPAWN_SPREAD de un
 * punto al azar y a HORDE_SPAWN_DEPTH casillas o menos del borde), alertados hacia su destino.
 * Devuelve la horda y el punto del borde del que salen.
 */
export function spawnHorde(
  w: World,
  kind: Horde['kind'],
  side: MapSide,
  size: number,
  goal: Point,
): { horde: Horde; at: Point } {
  const rng = w.zombieRng;
  const len = side < 2 ? w.grid.width : w.grid.height;
  const spread = Math.min(HORDE_SPAWN_SPREAD, Math.floor((len - 1) / 2));
  const center = nextInt(rng, spread, len - 1 - spread);
  const horde: Horde = { id: w.nextHordeId++, kind, goal: { ...goal }, done: false };
  w.hordes.push(horde);
  for (let k = 0; k < size; k++)
    for (let tries = 0; tries < 30; tries++) {
      const t = edgeTile(
        w,
        side,
        center + nextInt(rng, -spread, spread),
        nextInt(rng, 0, HORDE_SPAWN_DEPTH),
      );
      if (!isZombieWalkable(w.grid, t.x, t.y)) continue;
      const z = newZombie(w, t);
      z.hordeId = horde.id;
      z.state = 'alert';
      z.goal = kind === 'siege' ? siegeTarget(w) : { ...goal };
      z.lastSeenAt = w.tick;
      w.zombies.push(z);
      break;
    }
  return { horde, at: edgeTile(w, side, center, 0) };
}

/** Cada tick, antes de las llegadas por los bordes: llega el asedio anunciado si es su hora. */
export function hordeSystem(w: World): void {
  const s = w.siege;
  if (s && w.tick >= s.at) {
    w.siege = null;
    const { horde, at } = spawnHorde(w, 'siege', s.side, s.size, w.base.door);
    horde.until = w.tick + SIEGE_HOURS * TICKS_PER_HOUR;
    logEvent(w, { kind: 'siegeArrived', x: at.x, y: at.y });
  }
}
