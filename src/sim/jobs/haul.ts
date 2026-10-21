// Transportar (spec H4a §3.3): madera a los planos y montones al almacén.
import { BUILD } from '../balance';
import { emptyInventory, isEmpty, takeUpTo } from '../items';
import { findPath, regionOf } from '../path/astar';
import { prunePiles } from '../piles';
import { pick } from '../rng';
import type { Action, Activity, Blueprint, Survivor, World } from '../types';
import { tileOf } from '../world';
import { atOrBeside, standOnOrBeside } from './stand';

/** Madera que le falta al plano. */
export function woodNeeded(b: Blueprint): number {
  return BUILD[b.kind].wood - b.wood;
}

/** Plano que abastece (va a por madera o a entregarla), o `null`. */
export function supplyTarget(s: Survivor): number | null {
  const a = s.action;
  if (a.type !== 'moveTo') return null;
  if (a.then?.type === 'fetchWood' || a.then?.type === 'deliver') return a.then.blueprintId;
  return null;
}

/** Montón que va a recoger, o `null`. */
export function pileTarget(s: Survivor): number | null {
  const a = s.action;
  return a.type === 'moveTo' && a.then?.type === 'pickUp' ? a.then.pileId : null;
}

const dist2 = (s: Survivor, p: { x: number; y: number }) => {
  const t = tileOf(s.pos);
  return (p.x - t.x) ** 2 + (p.y - t.y) ** 2;
};

/** El plano sin abastecer que necesita madera más cercano, con dónde ponerse para entregarla. */
function blueprintToSupply(s: Survivor, w: World) {
  const claimed = new Set(w.survivors.filter((o) => o !== s).map(supplyTarget));
  let best: { b: Blueprint; stand: { x: number; y: number } } | null = null;
  for (const b of w.blueprints) {
    if (woodNeeded(b) <= 0 || claimed.has(b.id)) continue;
    if (best && dist2(s, b.pos) >= dist2(s, best.b.pos)) continue;
    const stand = standOnOrBeside(w, s, b.pos);
    if (stand) best = { b, stand };
  }
  return best;
}

/** Si lleva madera y algún plano la necesita, va a entregarla. */
export function deliverJob(s: Survivor, w: World): Action | null {
  if (s.carrying.wood <= 0) return null;
  const t = blueprintToSupply(s, w);
  return t && { type: 'moveTo', target: t.stand, then: { type: 'deliver', blueprintId: t.b.id } };
}

export function haulJob(s: Survivor, w: World): Action | null {
  if (w.storage.items.wood > 0) {
    const t = blueprintToSupply(s, w);
    if (t)
      return {
        type: 'moveTo',
        target: pick(w.rng, w.storage.tiles),
        then: { type: 'fetchWood', blueprintId: t.b.id },
      };
  }
  const claimed = new Set(w.survivors.filter((o) => o !== s).map(pileTarget));
  const at = tileOf(s.pos);
  const region = regionOf(w.grid, at.x, at.y);
  let best: { id: number; pos: { x: number; y: number } } | null = null;
  for (const p of w.piles) {
    if (claimed.has(p.id) || isEmpty(p.items)) continue;
    if (best && dist2(s, p.pos) >= dist2(s, best.pos)) continue;
    if (regionOf(w.grid, p.pos.x, p.pos.y) !== region) continue;
    best = { id: p.id, pos: p.pos };
  }
  return (
    best && { type: 'moveTo', target: { ...best.pos }, then: { type: 'pickUp', pileId: best.id } }
  );
}

export function haulStillWorth(s: Survivor, w: World): boolean {
  const a = s.action;
  if (a.type !== 'moveTo' || !a.then) return true;
  if (!s.work.haul) return false;
  if (a.then.type === 'pickUp') {
    const id = a.then.pileId;
    return w.piles.some((p) => p.id === id && !isEmpty(p.items));
  }
  if (a.then.type === 'fetchWood' || a.then.type === 'deliver') {
    const id = a.then.blueprintId;
    const b = w.blueprints.find((x) => x.id === id);
    if (!b || woodNeeded(b) <= 0) return false;
    return a.then.type === 'deliver' ? s.carrying.wood > 0 : w.storage.items.wood > 0;
  }
  return true;
}

/** Siguiente tramo de un transporte: ir a `target` y hacer `then` (con su camino ya calculado). */
function next(s: Survivor, target: { x: number; y: number }, then: Activity, w: World): Action {
  const path = findPath(w.grid, tileOf(s.pos), target);
  if (!path) return { type: 'idle', ticksLeft: 0 };
  s.path = path;
  return { type: 'moveTo', target, then };
}

/** Al llegar: recoger el montón (y llevarlo al almacén), coger madera o entregarla. */
export function startHaulActivity(
  s: Survivor,
  w: World,
  activity:
    | { type: 'pickUp'; pileId: number }
    | { type: 'fetchWood'; blueprintId: number }
    | { type: 'deliver'; blueprintId: number },
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  if (activity.type === 'pickUp') {
    const p = w.piles.find((x) => x.id === activity.pileId);
    if (!p || !atOrBeside(s, p.pos)) return idle;
    const taken = takeUpTo(p.items, s.carrying);
    prunePiles(w);
    if (isEmpty(taken)) return idle;
    return next(s, pick(w.rng, w.storage.tiles), { type: 'unload' }, w);
  }
  const b = w.blueprints.find((x) => x.id === activity.blueprintId);
  if (!b || woodNeeded(b) <= 0) return idle;
  if (activity.type === 'fetchWood') {
    const want = Math.min(woodNeeded(b), w.storage.items.wood);
    const taken = takeUpTo({ ...emptyInventory(), wood: want }, s.carrying);
    w.storage.items.wood -= taken.wood;
    if (taken.wood === 0) return idle;
    const stand = standOnOrBeside(w, s, b.pos);
    return stand ? next(s, stand, { type: 'deliver', blueprintId: b.id }, w) : idle;
  }
  if (!atOrBeside(s, b.pos)) return idle;
  const given = Math.min(woodNeeded(b), s.carrying.wood);
  s.carrying.wood -= given;
  b.wood += given;
  return idle;
}
