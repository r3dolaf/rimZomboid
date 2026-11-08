// Cultivar (spec V1 §4): cosechar lo maduro, regar lo seco (con agua de la fuente más cercana) y
// sembrar lo vacío (con semillas del almacén).
import {
  HARVEST_EXTRA_SEED,
  HARVEST_TICKS,
  HARVEST_VEG_BASE,
  HARVEST_VEG_PER_LEVEL,
  ITEM_WEIGHT_KG,
  SOW_TAKE_MAX,
  SOW_TICKS,
  WATER_CAN_LITERS,
  WATER_MOISTURE_HOURS,
  WATER_TICKS,
} from '../balance';
import { cropStage, needsWater, plotPos } from '../farm';
import { emptyInventory, weightOf } from '../items';
import { regionOf } from '../path/astar';
import { dropPile } from '../piles';
import { nextFloat, pick } from '../rng';
import { capacityKg, practice, workSpeed } from '../skills';
import type { Action, Activity, Furniture, Plot, Survivor, TendKind, World } from '../types';
import { mainsOn } from '../water';
import { tileOf } from '../world';
import { standOnOrBeside } from './stand';

type FarmActivity = Extract<Activity, { type: 'takeSeeds' | 'fillCan' | 'tend' }>;
type Tending = Extract<Action, { type: 'tend' }>;

const TICKS: Record<TendKind, number> = {
  sow: SOW_TICKS,
  water: WATER_TICKS,
  harvest: HARVEST_TICKS,
};

/** Lo que pide cada parcela. */
const WANTS: Record<TendKind, (p: Plot) => boolean> = {
  harvest: (p) => cropStage(p) === 'ripe',
  water: needsWater,
  sow: (p) => cropStage(p) === 'empty',
};

/** La parcela a la que va o en la que trabaja, o `null`. */
export function farmTarget(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'tend') return a.tile;
  if (a.type === 'moveTo' && a.then?.type === 'tend') return a.then.tile;
  return null;
}

const can = (s: Survivor) => s.waterCan ?? 0;

/** La parcela más cercana que pide eso, a la que llega y que no va a trabajar otro. */
function nearestPlot(s: Survivor, w: World, what: TendKind): Plot | null {
  const claimed = new Set(w.survivors.filter((o) => o !== s).map(farmTarget));
  const at = tileOf(s.pos);
  const region = regionOf(w.grid, at.x, at.y);
  let best: Plot | null = null;
  let bestD = Infinity;
  for (const p of w.plots) {
    if (!WANTS[what](p) || claimed.has(p.tile)) continue;
    const q = plotPos(w, p);
    const d = (q.x - at.x) ** 2 + (q.y - at.y) ** 2;
    if (d >= bestD || regionOf(w.grid, q.x, q.y) !== region) continue;
    best = p;
    bestD = d;
  }
  return best;
}

const goTend = (w: World, p: Plot, what: TendKind): Action => ({
  type: 'moveTo',
  target: plotPos(w, p),
  then: { type: 'tend', tile: p.tile, what },
});

/** ¿Da agua para regar? El fregadero con agua corriente; la cisterna y el barreño, si tienen. */
const gives = (w: World, f: Furniture) =>
  (f.kind === 'sink' && mainsOn(w)) ||
  ((f.kind === 'cistern' || f.kind === 'tub') && (f.water ?? 0) >= 1);

/** La fuente de agua más cercana a la que llega, y dónde ponerse. */
function nearestSource(
  s: Survivor,
  w: World,
): { f: Furniture; stand: { x: number; y: number } } | null {
  const at = tileOf(s.pos);
  let best: { f: Furniture; stand: { x: number; y: number } } | null = null;
  let bestD = Infinity;
  for (const f of w.furniture) {
    if (!gives(w, f)) continue;
    const d = (f.pos.x - at.x) ** 2 + (f.pos.y - at.y) ** 2;
    if (d >= bestD) continue;
    const stand = standOnOrBeside(w, s, f.pos);
    if (!stand) continue;
    best = { f, stand };
    bestD = d;
  }
  return best;
}

/** Sembrar con las semillas que lleva (también vuelve a ello quien va cargado de semillas). */
export function sowJob(s: Survivor, w: World): Action | null {
  if (s.carrying.seeds === 0 || w.plots.length === 0) return null;
  const p = nearestPlot(s, w, 'sow');
  return p && goTend(w, p, 'sow');
}

/** El trabajo de Cultivar que toca: cosechar, regar (o ir a por agua) y sembrar (o ir a por semillas). */
export function farmJob(s: Survivor, w: World): Action | null {
  if (w.plots.length === 0) return null;
  const ripe = nearestPlot(s, w, 'harvest');
  if (ripe) return goTend(w, ripe, 'harvest');
  const dry = nearestPlot(s, w, 'water');
  if (dry) {
    if (can(s) >= 1) return goTend(w, dry, 'water');
    const src = nearestSource(s, w);
    if (src)
      return { type: 'moveTo', target: src.stand, then: { type: 'fillCan', sourceId: src.f.id } };
  }
  const sow = sowJob(s, w);
  if (sow) return sow;
  if (w.storage.items.seeds > 0 && nearestPlot(s, w, 'sow'))
    return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'takeSeeds' } };
  return null;
}

/** ¿Sigue teniendo sentido lo que hace? */
export function farmStillWorth(s: Survivor, w: World): boolean {
  if (!s.work.farm) return false;
  const a = s.action;
  const t = a.type === 'moveTo' ? a.then : a;
  if (t?.type === 'takeSeeds') return w.storage.items.seeds > 0;
  if (t?.type === 'fillCan') {
    const f = w.furniture.find((x) => x.id === t.sourceId);
    return f !== undefined && gives(w, f) && can(s) < WATER_CAN_LITERS;
  }
  if (t?.type !== 'tend') return false;
  const p = w.plots.find((x) => x.tile === t.tile);
  if (!p || !WANTS[t.what](p)) return false;
  if (t.what === 'sow') return s.carrying.seeds > 0;
  if (t.what === 'water') return can(s) >= 1;
  return true;
}

/** Cuántas semillas coge: las que vaya a sembrar (hasta SOW_TAKE_MAX) y le quepan. */
function seedsToTake(s: Survivor, w: World): number {
  const empty = w.plots.filter((p) => cropStage(p) === 'empty').length;
  const fit = Math.floor((capacityKg(s) - weightOf(s.carrying)) / ITEM_WEIGHT_KG.seeds + 1e-9);
  return Math.max(0, Math.min(w.storage.items.seeds, SOW_TAKE_MAX, empty, fit));
}

/** Al llegar: coge semillas, coge agua o empieza a trabajar la parcela. */
export function startFarmActivity(s: Survivor, w: World, activity: FarmActivity): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  if (activity.type === 'takeSeeds') {
    const n = seedsToTake(s, w);
    w.storage.items.seeds -= n;
    s.carrying.seeds += n;
    return idle;
  }
  if (activity.type === 'fillCan') {
    const f = w.furniture.find((x) => x.id === activity.sourceId);
    if (!f || !gives(w, f)) return idle;
    const want = WATER_CAN_LITERS - can(s);
    const take = f.kind === 'sink' ? want : Math.min(want, Math.floor(f.water ?? 0));
    if (f.kind !== 'sink') f.water = (f.water ?? 0) - take;
    s.waterCan = can(s) + take;
    return idle;
  }
  const p = w.plots.find((x) => x.tile === activity.tile);
  const here = tileOf(s.pos);
  if (!p || here.y * w.grid.width + here.x !== p.tile || !farmStillWorthTend(s, p, activity.what))
    return idle;
  const ticksLeft = Math.max(1, Math.round(TICKS[activity.what] / workSpeed(s, 'farm')));
  return { type: 'tend', tile: p.tile, what: activity.what, ticksLeft };
}

const farmStillWorthTend = (s: Survivor, p: Plot, what: TendKind) =>
  WANTS[what](p) && (what !== 'sow' || s.carrying.seeds > 0) && (what !== 'water' || can(s) >= 1);

/** Hortalizas de una cosecha con su nivel: la parte entera y la fracción con su probabilidad. */
export function harvestVeg(level: number, roll: number): number {
  const exact = HARVEST_VEG_BASE + HARVEST_VEG_PER_LEVEL * level;
  const whole = Math.floor(exact + 1e-9);
  return whole + (roll < exact - whole - 1e-9 ? 1 : 0);
}

/** Un tick trabajando la parcela; al terminar, siembra, riega o cosecha. Devuelve si ha terminado. */
export function tendStep(w: World, s: Survivor, a: Tending): boolean {
  practice(w, s, 'farm', 1);
  if (--a.ticksLeft > 0) return false;
  const p = w.plots.find((x) => x.tile === a.tile);
  if (!p || !farmStillWorthTend(s, p, a.what)) return true;
  if (a.what === 'sow') {
    s.carrying.seeds--;
    p.crop = { grown: 0, ripe: 0, dry: 0 };
  } else if (a.what === 'water') {
    s.waterCan = can(s) - 1;
    p.moisture = Math.max(p.moisture, WATER_MOISTURE_HOURS);
  } else {
    const veg = harvestVeg(s.skills.farm.level, nextFloat(w.rng));
    const seeds = 1 + (nextFloat(w.rng) < HARVEST_EXTRA_SEED ? 1 : 0);
    p.crop = null;
    dropPile(w, plotPos(w, p), { ...emptyInventory(), veg, seeds });
  }
  return true;
}
