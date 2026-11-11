// Las crisis de ánimo (spec B2): encerrarse, atracón, rabia y huida, según cómo es cada uno; y la
// inspiración, con el ánimo alto.
import {
  BINGE_FOOD,
  CRISIS_HOURS,
  CRISIS_TRAITS,
  CRISIS_WEIGHTS,
  FLEE_DIST,
  INSPIRE_CHANCE,
  INSPIRE_HOUR,
  INSPIRE_MOOD,
  NOISE,
  RAGE_DAMAGE,
  RAGE_HIT_TICKS,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { baseFloor } from './base';
import { gameTime } from './clock';
import { contains } from './geom';
import { eatFrom, hasFood } from './food';
import { standBeside } from './jobs/stand';
import { logEvent } from './log';
import { isWalkable } from './map/grid';
import { makeNoise } from './noise';
import { nextFloat, nextInt, pick, weightedPick } from './rng';
import { damageTile, resistanceOf } from './structures';
import {
  Tile,
  type Action,
  type Activity,
  type CrisisKind,
  type Point,
  type Survivor,
  type World,
} from './types';

/** Lo que golpea la rabia: puertas y ventanas de la base (sin romper aún). */
const RAGE_TILES: ReadonlySet<Tile> = new Set([
  Tile.Window,
  Tile.CurtainedWindow,
  Tile.BoardedWindow,
  Tile.Door,
]);

/** Las puertas y ventanas de la base que se pueden golpear (índices y·ancho + x). */
function rageTargets(w: World): number[] {
  const { x, y, w: width, h } = w.base.rect;
  const out: number[] = [];
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + width; i++)
      if (
        RAGE_TILES.has(w.grid.tiles[j * w.grid.width + i]!) &&
        resistanceOf(w, i, j) !== undefined
      )
        out.push(j * w.grid.width + i);
  return out;
}

/** Qué crisis le toca (§1): al azar con sus pesos, según sus rasgos y lo que haya. */
export function chooseCrisis(s: Survivor, w: World): CrisisKind {
  const weights: Record<CrisisKind, number> = { ...CRISIS_WEIGHTS };
  for (const kind of ['binge', 'rage', 'flee'] as const)
    for (const [trait, mult] of Object.entries(CRISIS_TRAITS[kind]))
      if (s.traits.includes(trait as Survivor['traits'][number])) weights[kind] *= mult;
  if (!hasFood(w.storage.items)) weights.binge = 0;
  if (rageTargets(w).length === 0) weights.rage = 0;
  if (s.traits.includes('brave')) weights.flee = 0;
  return weightedPick(w.rng, weights);
}

/** Una casilla que se pisa fuera de la base, lejos (a FLEE_DIST de su centro), o `null`. */
function fleeSpot(w: World): Point | null {
  const r = w.base.rect;
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
  for (let k = 0; k < 60; k++) {
    const a = nextFloat(w.rng) * Math.PI * 2;
    const d = nextInt(w.rng, FLEE_DIST[0], FLEE_DIST[1]);
    const p = { x: Math.floor(cx + Math.cos(a) * d), y: Math.floor(cy + Math.sin(a) * d) };
    if (p.x < 0 || p.y < 0 || p.x >= w.grid.width || p.y >= w.grid.height) continue;
    if (isWalkable(w.grid, p.x, p.y) && !contains(r, p)) return p;
  }
  return null;
}

/**
 * Adónde va a tener la crisis (§1): `kind`, la que toque (si no se dice, al azar). Si no hay dónde
 * (sin puertas que golpear, sin sitio para huir), se encierra.
 */
export function crisisAction(s: Survivor, w: World, kind = chooseCrisis(s, w)): Action {
  const sulk: Action = {
    type: 'moveTo',
    target: pick(w.rng, baseFloor(w)),
    then: { type: 'crisis', kind: 'sulk' },
  };
  if (kind === 'binge') {
    if (w.storage.tiles.length === 0) return sulk;
    return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'crisis', kind } };
  }
  if (kind === 'rage') {
    const targets = rageTargets(w);
    if (targets.length === 0) return sulk;
    const tile = pick(w.rng, targets);
    const p = { x: tile % w.grid.width, y: Math.floor(tile / w.grid.width) };
    const stand = standBeside(w, s, p);
    if (!stand) return sulk;
    return { type: 'moveTo', target: stand, then: { type: 'crisis', kind, tile } };
  }
  if (kind === 'flee') {
    const spot = fleeSpot(w);
    if (!spot) return sulk;
    return { type: 'moveTo', target: spot, then: { type: 'crisis', kind } };
  }
  return sulk;
}

/** Al llegar, empieza (y se registra): el atracón se come lo suyo en ese momento. */
export function startCrisis(
  s: Survivor,
  w: World,
  activity: Extract<Activity, { type: 'crisis' }>,
): Action {
  const kind = activity.kind ?? 'sulk';
  const ticksLeft = CRISIS_HOURS[kind] * TICKS_PER_HOUR;
  if (kind === 'binge') {
    let food = 0;
    while (food < BINGE_FOOD) {
      const ate = eatFrom(w.storage.items);
      if (!ate) break;
      food++;
    }
    s.needs.hunger = 100;
    logEvent(w, { kind: 'crisis', survivorId: s.id, crisis: kind, food });
  } else logEvent(w, { kind: 'crisis', survivorId: s.id, crisis: kind });
  return activity.tile === undefined
    ? { type: 'crisis', ticksLeft, kind }
    : { type: 'crisis', ticksLeft, kind, tile: activity.tile };
}

/** Un tick de crisis: la rabia golpea lo suyo cada poco (y se oye). */
export function crisisTick(w: World, s: Survivor, a: Extract<Action, { type: 'crisis' }>): void {
  if (a.kind !== 'rage' || a.tile === undefined || a.ticksLeft % RAGE_HIT_TICKS !== 0) return;
  const [x, y] = [a.tile % w.grid.width, Math.floor(a.tile / w.grid.width)];
  if (resistanceOf(w, x, y) === undefined) return; // ya está roto
  makeNoise(w, s.pos, NOISE.fightHit);
  damageTile(w, x, y, RAGE_DAMAGE);
}

/**
 * La inspiración (§2): a las 9 en punto, quien tiene el ánimo alto (y no está ya inspirado) tiene un
 * 15 % de inspirarse un día; al acabar, se le pasa.
 */
export function inspirationSystem(w: World): void {
  for (const s of w.survivors)
    if (s.inspiredUntil !== undefined && w.tick >= s.inspiredUntil) delete s.inspiredUntil;
  if (w.tick % TICKS_PER_HOUR !== 0 || gameTime(w.tick).hour !== INSPIRE_HOUR) return;
  for (const s of w.survivors) {
    if (s.inspiredUntil !== undefined || s.needs.mood < INSPIRE_MOOD) continue;
    if (nextFloat(w.rng) >= INSPIRE_CHANCE) continue;
    s.inspiredUntil = w.tick + TICKS_PER_DAY;
    logEvent(w, { kind: 'inspired', survivorId: s.id });
  }
}
