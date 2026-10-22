// Sanar (spec H4e §4): rescatar a los derribados (llevarlos en brazos a una cama o a la base).
import { RESCUE_SAFE_RANGE } from '../balance';
import { baseFloor } from '../base';
import { seenByColony } from '../danger';
import { contains } from '../geom';
import { logEvent } from '../log';
import { findPath, regionOf } from '../path/astar';
import { pick } from '../rng';
import { practice } from '../skills';
import type { Action, Activity, Point, Survivor, World } from '../types';
import { tileOf } from '../world';

const sameTile = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** A quién va a rescatar o lleva en brazos, o `null`. */
export function rescueTargetId(s: Survivor): number | null {
  if (s.carryingId !== null) return s.carryingId;
  const a = s.action;
  if (a.type === 'moveTo' && (a.then?.type === 'rescue' || a.then?.type === 'dropOff'))
    return a.then.downedId;
  return null;
}

/** ¿Hay otro derribado ya en esa cama? */
function bedTaken(w: World, p: Point, except: Survivor): boolean {
  return w.survivors.some(
    (o) =>
      o !== except && o.action.type === 'downed' && o.action.inBed && sameTile(tileOf(o.pos), p),
  );
}

/**
 * Adónde llevarlo: a su cama; si no, a una sin dueño; si no, al suelo de la base (`'floor'`). Si
 * ya está en la base y no hay cama, a ningún sitio (`null`).
 */
function rescueSpot(w: World, d: Survivor): Point | 'floor' | null {
  const own = w.beds.find((b) => b.id === d.bedId && b.ownerId === d.id);
  if (own && !bedTaken(w, own.pos, d)) return own.pos;
  const spare = w.beds.find((b) => b.ownerId === null && !bedTaken(w, b.pos, d));
  if (spare) return spare.pos;
  return contains(w.base.rect, tileOf(d.pos)) ? null : 'floor';
}

/** ¿Hace falta rescatarlo? Derribado, no en cama, sin nadie que lo lleve ni vaya (salvo `by`). */
function rescuable(w: World, d: Survivor, by: Survivor): boolean {
  const a = d.action;
  if (a.type !== 'downed' || a.inBed || a.carriedBy !== undefined) return false;
  if (w.survivors.some((o) => o !== by && rescueTargetId(o) === d.id)) return false;
  return rescueSpot(w, d) !== null;
}

/** ¿Ve algún colono un zombi a RESCUE_SAFE_RANGE casillas o menos del derribado? */
function zombiesNear(w: World, d: Survivor): boolean {
  const r2 = RESCUE_SAFE_RANGE * RESCUE_SAFE_RANGE;
  return w.zombies.some(
    (z) => (z.pos.x - d.pos.x) ** 2 + (z.pos.y - d.pos.y) ** 2 <= r2 && seenByColony(w, z),
  );
}

const goRescue = (d: Survivor): Action => ({
  type: 'moveTo',
  target: tileOf(d.pos),
  then: { type: 'rescue', downedId: d.id },
});

/** Rescatar al derribado más cercano al que se pueda llegar, sin zombis a la vista cerca. */
function rescueJob(s: Survivor, w: World): Action | null {
  const here = tileOf(s.pos);
  const region = regionOf(w.grid, here.x, here.y);
  let best: Survivor | null = null;
  let bestD = Infinity;
  for (const d of w.survivors) {
    if (d === s || !rescuable(w, d, s) || zombiesNear(w, d)) continue;
    const t = tileOf(d.pos);
    if (regionOf(w.grid, t.x, t.y) !== region) continue;
    const dist = (t.x - here.x) ** 2 + (t.y - here.y) ** 2;
    if (dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best && goRescue(best);
}

/** El trabajo Sanar: rescatar, o `null` si no hay nada que hacer. */
export function healJob(s: Survivor, w: World): Action | null {
  return rescueJob(s, w);
}

/** Rescate mandado en modo combate: sin mirar si hay zombis cerca. */
export function rescueOrder(w: World, s: Survivor, d: Survivor): Action | null {
  return rescuable(w, d, s) ? goRescue(d) : null;
}

/** ¿Sigue teniendo sentido? (El que lo lleva, mientras lo lleve.) */
export function healStillWorth(s: Survivor, w: World): boolean {
  const a = s.action;
  if (a.type !== 'moveTo' || !a.then) return true;
  const then = a.then;
  if (then.type === 'dropOff') return s.carryingId === then.downedId;
  if (then.type !== 'rescue') return true;
  const d = w.survivors.find((x) => x.id === then.downedId);
  return d !== undefined && s.work.heal && rescuable(w, d, s) && !zombiesNear(w, d);
}

/** Al llegar: coge al derribado y sale hacia su sitio, o lo deja. */
export function startHealActivity(
  s: Survivor,
  w: World,
  activity: Extract<Activity, { type: 'rescue' | 'dropOff' }>,
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const d = w.survivors.find((x) => x.id === activity.downedId);
  if (activity.type === 'rescue') {
    if (!d || d.action.type !== 'downed' || !rescuable(w, d, s)) return idle;
    if ((d.pos.x - s.pos.x) ** 2 + (d.pos.y - s.pos.y) ** 2 > 2.25) return idle;
    const spot = rescueSpot(w, d);
    if (spot === null) return idle;
    const target = spot === 'floor' ? pick(w.rng, baseFloor(w)) : spot;
    const path = findPath(w.grid, tileOf(s.pos), target);
    if (!path) return idle;
    s.carryingId = d.id;
    d.action.carriedBy = s.id;
    d.pos = { ...s.pos };
    s.path = path;
    return { type: 'moveTo', target, then: { type: 'dropOff', downedId: d.id } };
  }
  if (d && s.carryingId === d.id && d.action.type === 'downed') {
    const t = tileOf(s.pos);
    d.pos = { x: t.x + 0.5, y: t.y + 0.5 };
    delete d.action.carriedBy;
    d.action.inBed = w.beds.some((b) => sameTile(b.pos, t));
    logEvent(w, { kind: 'rescued', survivorId: s.id, otherId: d.id });
  }
  s.carryingId = null;
  return idle;
}

/** Lo suelta donde está (sigue derribado, en el suelo). */
export function dropCarried(w: World, s: Survivor): void {
  const d = w.survivors.find((x) => x.id === s.carryingId);
  if (d && d.action.type === 'downed') delete d.action.carriedBy;
  s.carryingId = null;
}

/**
 * Después de las actividades: el llevado va con quien lo lleva (y este aprende Sanar); si ya no lo
 * lleva (pelea, le derriban, le mandan otra cosa…), lo suelta.
 */
export function carrySystem(w: World): void {
  for (const s of w.survivors) {
    if (s.carryingId === null) continue;
    const a = s.action;
    const d = w.survivors.find((x) => x.id === s.carryingId);
    const still =
      a.type === 'moveTo' &&
      a.then?.type === 'dropOff' &&
      a.then.downedId === s.carryingId &&
      d?.action.type === 'downed';
    if (!still || !d) {
      dropCarried(w, s);
      continue;
    }
    d.pos = { ...s.pos };
    practice(w, s, 'heal', 1);
  }
}
