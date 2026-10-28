// Llenar el barreño (spec H5b §6), en Transportar: con el cubo de agua o las botellas del almacén,
// o llevando un cubo vacío a la fuente más cercana (fregadero con agua corriente o cisterna).
import { BOTTLE_LITERS, BUCKET_LITERS, ITEM_WEIGHT_KG, TUB_LITERS } from '../balance';
import { weightOf } from '../items';
import { findPath, regionOf } from '../path/astar';
import { pick } from '../rng';
import { capacityKg } from '../skills';
import type { Action, Activity, Furniture, Point, Survivor, World } from '../types';
import { mainsOn } from '../water';
import { tileOf } from '../world';
import { atOrBeside, standOnOrBeside } from './stand';

type WaterActivity = Extract<Activity, { type: 'takeWater' | 'fillBucket' | 'pourWater' }>;

/** Lo que le cabe al barreño. */
const room = (f: Furniture) => TUB_LITERS - (f.water ?? 0);

/** El barreño que va a llenar (o está llenando), o `null`. */
export function waterTarget(s: Survivor): number | null {
  const a = s.action;
  if (a.type !== 'moveTo') return null;
  const t = a.then;
  return t?.type === 'takeWater' || t?.type === 'fillBucket' || t?.type === 'pourWater'
    ? t.tubId
    : null;
}

const dist2 = (s: Survivor, p: Point) => (p.x + 0.5 - s.pos.x) ** 2 + (p.y + 0.5 - s.pos.y) ** 2;

/** ¿Da agua ahora? El fregadero, con agua corriente; la cisterna, con un cubo al menos. */
const flows = (w: World, f: Furniture) =>
  (f.kind === 'sink' && mainsOn(w)) || (f.kind === 'cistern' && (f.water ?? 0) >= BUCKET_LITERS);

/** La fuente más cercana a la que llega. */
function nearestSource(s: Survivor, w: World): Furniture | null {
  const at = tileOf(s.pos);
  const region = regionOf(w.grid, at.x, at.y);
  let best: Furniture | null = null;
  for (const f of w.furniture) {
    if (!flows(w, f) || (best && dist2(s, f.pos) >= dist2(s, best.pos))) continue;
    if (!standOnOrBeside(w, s, f.pos) || regionOf(w.grid, f.pos.x, f.pos.y) !== region) continue;
    best = f;
  }
  return best;
}

/** Cómo lo llenaría: con un cubo de agua, con botellas o yendo a la fuente con un cubo vacío. */
function how(s: Survivor, w: World, tub: Furniture): 'bucket' | 'bottles' | 'source' | null {
  const st = w.storage.items;
  if (room(tub) >= BUCKET_LITERS && st.waterBucket > 0) return 'bucket';
  if (room(tub) >= BOTTLE_LITERS && st.waterBottle > 0) return 'bottles';
  if (room(tub) >= BUCKET_LITERS && st.bucket > 0 && nearestSource(s, w)) return 'source';
  return null;
}

/** El barreño más cercano que se puede llenar y que nadie está llenando ya. */
function tubToFill(s: Survivor, w: World): Furniture | null {
  const busy = new Set(w.survivors.filter((o) => o !== s).map(waterTarget));
  let best: Furniture | null = null;
  for (const f of w.furniture) {
    if (f.kind !== 'tub' || busy.has(f.id) || (best && dist2(s, f.pos) >= dist2(s, best.pos)))
      continue;
    if (standOnOrBeside(w, s, f.pos) && how(s, w, f)) best = f;
  }
  return best;
}

/** Si hay un barreño que llenar y con qué, va al almacén. */
export function waterJob(s: Survivor, w: World): Action | null {
  const tub = tubToFill(s, w);
  if (!tub) return null;
  return {
    type: 'moveTo',
    target: pick(w.rng, w.storage.tiles),
    then: { type: 'takeWater', tubId: tub.id },
  };
}

export function waterStillWorth(s: Survivor, w: World): boolean {
  const a = s.action;
  if (a.type !== 'moveTo' || !a.then) return true;
  if (!s.work.haul) return false;
  const t = a.then;
  if (t.type !== 'takeWater' && t.type !== 'fillBucket' && t.type !== 'pourWater') return true;
  const tub = w.furniture.find((f) => f.id === t.tubId && f.kind === 'tub');
  if (!tub) return false;
  if (t.type === 'takeWater') return how(s, w, tub) !== null;
  if (t.type === 'fillBucket') {
    const src = w.furniture.find((f) => f.id === t.sourceId);
    return !!src && flows(w, src) && room(tub) >= BUCKET_LITERS;
  }
  return true;
}

/** Va a `target` y allí hace `then` (o se queda si no hay camino). */
function goTo(s: Survivor, w: World, p: Point, then: WaterActivity): Action {
  const stand = standOnOrBeside(w, s, p);
  const path = stand && findPath(w.grid, tileOf(s.pos), stand);
  if (!stand || !path) return { type: 'idle', ticksLeft: 0 };
  s.path = path;
  return { type: 'moveTo', target: stand, then };
}

/** Lo que cabe en su carga de algo que pesa `kg` cada uno. */
const fits = (s: Survivor, kg: number) =>
  Math.floor((capacityKg(s) - weightOf(s.carrying)) / kg + 1e-9);

/**
 * En el almacén coge el cubo de agua, las botellas o el cubo vacío; en la fuente llena el cubo;
 * en el barreño vacía lo que lleve (las botellas vacías se tiran; el cubo vuelve al almacén al
 * descargar).
 */
export function startWaterActivity(s: Survivor, w: World, activity: WaterActivity): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const tub = w.furniture.find((f) => f.id === activity.tubId && f.kind === 'tub');
  if (!tub) return idle;
  const st = w.storage.items;
  if (activity.type === 'takeWater') {
    const way = how(s, w, tub);
    const pour: WaterActivity = { type: 'pourWater', tubId: tub.id };
    if (way === 'bucket' && fits(s, ITEM_WEIGHT_KG.waterBucket) >= 1) {
      st.waterBucket--;
      s.carrying.waterBucket++;
      return goTo(s, w, tub.pos, pour);
    }
    if (way === 'bottles') {
      const n = Math.min(room(tub), st.waterBottle, fits(s, ITEM_WEIGHT_KG.waterBottle));
      if (n < 1) return idle;
      st.waterBottle -= n;
      s.carrying.waterBottle += n;
      return goTo(s, w, tub.pos, pour);
    }
    const src = way === 'source' ? nearestSource(s, w) : null;
    if (!src || fits(s, ITEM_WEIGHT_KG.waterBucket) < 1) return idle;
    st.bucket--;
    s.carrying.bucket++;
    return goTo(s, w, src.pos, { type: 'fillBucket', sourceId: src.id, tubId: tub.id });
  }
  if (activity.type === 'fillBucket') {
    const src = w.furniture.find((f) => f.id === activity.sourceId);
    if (!src || !atOrBeside(s, src.pos) || !flows(w, src) || s.carrying.bucket < 1) return idle;
    if (src.kind === 'cistern') src.water = (src.water ?? 0) - BUCKET_LITERS;
    s.carrying.bucket--;
    s.carrying.waterBucket++;
    return goTo(s, w, tub.pos, { type: 'pourWater', tubId: tub.id });
  }
  if (!atOrBeside(s, tub.pos)) return idle;
  while (s.carrying.waterBucket > 0 && room(tub) >= BUCKET_LITERS) {
    tub.water = (tub.water ?? 0) + BUCKET_LITERS;
    s.carrying.waterBucket--;
    s.carrying.bucket++;
  }
  while (s.carrying.waterBottle > 0 && room(tub) >= BOTTLE_LITERS) {
    tub.water = (tub.water ?? 0) + BOTTLE_LITERS;
    s.carrying.waterBottle--;
  }
  return idle;
}
