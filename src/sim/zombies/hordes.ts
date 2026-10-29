// Las hordas del narrador (spec H4e §2): la llegada del asedio, su empeño en la base y su fin; los
// errantes que cruzan el mapa. Las posiciones, con `zombieRng`, para no cambiar el resto.
import {
  HORDE_LEG,
  HORDE_LEG_SNAP,
  HORDE_SPAWN_DEPTH,
  HORDE_SPAWN_SPREAD,
  SIEGE_GIVE_UP_HOURS,
  SIEGE_HOURS,
  SIEGE_SIZE,
  TICKS_PER_HOUR,
  WANDERERS_EXIT_RANGE,
  WANDERERS_SIGHT_TICKS,
  WANDERERS_SIZE,
  ZOMBIE_LEVEL_MULT,
} from '../balance';
import { baseFloor } from '../base';
import { gameTime } from '../clock';
import { seenByColony } from '../danger';
import { piecesGone } from '../clothes';
import { logEvent } from '../log';
import { isZombieWalkable } from '../map/grid';
import { nextInt } from '../rng';
import type { Horde, MapSide, Point, World, Zombie } from '../types';
import { tileOf } from '../world';
import { indoors, newZombie } from './spawn';

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

/** Cuántos errantes: 8–15 por la opción de la portada. */
export function wanderersSize(w: World): number {
  const [lo, hi] = WANDERERS_SIZE;
  return Math.round(nextInt(w.rng, lo, hi) * ZOMBIE_LEVEL_MULT[w.zombieLevel]);
}

/** Margen a los lados del punto del borde del que sale una horda. */
const spreadOf = (w: World, side: MapSide) =>
  Math.min(HORDE_SPAWN_SPREAD, Math.floor(((side < 2 ? w.grid.width : w.grid.height) - 1) / 2));

/** Un punto al azar a lo largo del borde `side` (lejos de las esquinas). */
function hordeCenter(w: World, side: MapSide): number {
  const len = side < 2 ? w.grid.width : w.grid.height;
  const spread = spreadOf(w, side);
  return nextInt(w.zombieRng, spread, len - 1 - spread);
}

/**
 * Hace aparecer una horda de `size` zombis juntos en el borde `side` (a ±HORDE_SPAWN_SPREAD del
 * punto `center` y a HORDE_SPAWN_DEPTH casillas o menos del borde), alertados hacia su destino.
 * Devuelve la horda y el punto del borde del que salen.
 */
function spawnHorde(
  w: World,
  kind: Horde['kind'],
  side: MapSide,
  size: number,
  center: number,
  goal: Point,
): { horde: Horde; at: Point } {
  const rng = w.zombieRng;
  const spread = spreadOf(w, side);
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

/** Llega el asedio anunciado: por su lado, hacia la base, empeñado en ella un día. */
function siegeArrives(w: World, side: MapSide, size: number): void {
  const center = hordeCenter(w, side);
  const { horde, at } = spawnHorde(w, 'siege', side, size, center, w.base.door);
  horde.until = w.tick + SIEGE_HOURS * TICKS_PER_HOUR;
  horde.from = { side, center };
  logEvent(w, { kind: 'siegeArrived', x: at.x, y: at.y });
}

/** Errantes: salen juntos del borde `side` hacia un punto que se pisa del de enfrente. */
export function spawnWanderers(w: World, side: MapSide, size: number): Horde {
  const center = hordeCenter(w, side);
  const other = (side ^ 1) as MapSide;
  const len = other < 2 ? w.grid.width : w.grid.height;
  let goal = edgeTile(w, other, center, 0);
  for (let k = 0; k < 60; k++) {
    // Enfrente; si ahí no se pisa, cada vez más lejos a lo largo del borde.
    const along = Math.min(len - 1, Math.max(0, center + nextInt(w.zombieRng, -k, k)));
    const t = edgeTile(w, other, along, nextInt(w.zombieRng, 0, HORDE_SPAWN_DEPTH));
    if (isZombieWalkable(w.grid, t.x, t.y)) {
      goal = t;
      break;
    }
  }
  return spawnHorde(w, 'wander', side, size, center, goal).horde;
}

/**
 * Punto intermedio hacia `goal` (spec H4e §2.2, tramos): a HORDE_LEG casillas como mucho en línea
 * recta, en la casilla de fuera (que se pisa y no está en un edificio: así no van rompiendo casas)
 * más cercana, a HORDE_LEG_SNAP o menos; si no la hay, `goal`.
 */
export function legToward(w: World, from: Point, goal: Point): Point {
  const dx = goal.x - from.x;
  const dy = goal.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= HORDE_LEG) return goal;
  const cx = Math.round(from.x + (dx / d) * HORDE_LEG);
  const cy = Math.round(from.y + (dy / d) * HORDE_LEG);
  const outside = (x: number, y: number) => isZombieWalkable(w.grid, x, y) && !indoors(w, x, y);
  for (let r = 0; r <= HORDE_LEG_SNAP; r++)
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++)
        if (Math.max(Math.abs(i), Math.abs(j)) === r && outside(cx + i, cy + j))
          return { x: cx + i, y: cy + j };
  return goal;
}

/** La horda que manda ahora en el zombi, si es de una y no ha terminado. */
export function activeHorde(w: World, z: Zombie): Horde | null {
  if (z.hordeId === null) return null;
  const h = w.hordes.find((x) => x.id === z.hordeId);
  return h && !h.done ? h : null;
}

/**
 * Termina un asedio: la horda se va por donde vino, como unos errantes (revisión de H4e: si se
 * quedaban rondando la base, derribaban otra vez a quien se levantaba). El que persigue a alguien
 * sigue con lo suyo y, cuando lo pierde, se va con los demás.
 */
function endSiege(w: World, h: Horde, mine: Zombie[]): void {
  h.kind = 'wander';
  h.goal = h.from ? backTo(w, h.from) : { ...h.goal };
  h.seen = true; // no es una horda errante nueva: sin aviso
  delete h.until;
  delete h.allDownSince;
  for (const z of mine) {
    if (z.state === 'chase') continue;
    z.state = 'alert';
    z.goal = { ...h.goal };
    z.path = [];
    z.lastSeenAt = w.tick;
  }
}

/** Una casilla que se pisa del borde de `from`, cerca de por donde llegó la horda. */
function backTo(w: World, from: { side: MapSide; center: number }): Point {
  const spread = spreadOf(w, from.side);
  for (let k = 0; k < 30; k++) {
    const t = edgeTile(
      w,
      from.side,
      from.center + nextInt(w.zombieRng, -spread, spread),
      nextInt(w.zombieRng, 0, HORDE_SPAWN_DEPTH),
    );
    if (isZombieWalkable(w.grid, t.x, t.y)) return t;
  }
  return edgeTile(w, from.side, from.center, 0);
}

/** Cada tick, antes de las llegadas por los bordes: llega el asedio anunciado si es su hora. */
export function hordeSystem(w: World): void {
  const s = w.siege;
  if (s && w.tick >= s.at) {
    w.siege = null;
    siegeArrives(w, s.side, s.size);
  }
  for (const h of w.hordes) {
    if (h.done) continue;
    let mine = w.zombies.filter((z) => z.hordeId === h.id);
    if (h.kind === 'siege') {
      if (mine.length === 0) {
        h.done = true;
        if (w.common.over === null) w.common.stats.siegesRepelled++;
        logEvent(w, { kind: 'siegeRepelled' });
        continue;
      }
      // Sin nadie en pie un rato, se cansa (si no, se levantaban entre ellos y volvían a caer).
      if (w.survivors.some((s) => s.action.type !== 'downed')) delete h.allDownSince;
      else h.allDownSince ??= w.tick;
      const tired =
        h.allDownSince !== undefined &&
        w.tick - h.allDownSince >= SIEGE_GIVE_UP_HOURS * TICKS_PER_HOUR;
      if (tired || w.tick >= h.until!) {
        endSiege(w, h, mine);
        if (w.common.over === null) w.common.stats.siegesRepelled++;
        logEvent(w, { kind: 'siegeEnded' });
      }
      continue;
    }
    // Errantes: los que llegan a su destino salen del mapa.
    const r2 = WANDERERS_EXIT_RANGE * WANDERERS_EXIT_RANGE;
    const out = new Set(
      mine.filter((z) => (z.pos.x - h.goal.x - 0.5) ** 2 + (z.pos.y - h.goal.y - 0.5) ** 2 <= r2),
    );
    if (out.size > 0) {
      w.zombies = w.zombies.filter((z) => !out.has(z));
      for (const z of out) piecesGone(w, [...z.worn, ...z.bags]); // H5b: con su ropa (y bolsas)
      mine = mine.filter((z) => !out.has(z));
    }
    if (mine.length === 0) {
      h.done = true;
      continue;
    }
    if (!h.seen && w.tick % WANDERERS_SIGHT_TICKS === 0) {
      const z = mine.find((x) => seenByColony(w, x));
      if (z) {
        h.seen = true;
        logEvent(w, { kind: 'wanderersSighted', ...tileOf(z.pos) });
      }
    }
  }
  // Las terminadas, cuando ya no queda ningún zombi suyo.
  if (w.hordes.some((h) => h.done))
    w.hordes = w.hordes.filter((h) => !h.done || w.zombies.some((z) => z.hordeId === h.id));
}
