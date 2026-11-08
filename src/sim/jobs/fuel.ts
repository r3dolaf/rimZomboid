// Leña para las hogueras (spec V3 §4), en Transportar: a la que le quedan menos de 8 horas se le
// llevan tablas del almacén hasta 24 (cada tabla, 4 horas).
import {
  CAMPFIRE_FUEL_MAX,
  CAMPFIRE_REFUEL_BELOW,
  FUEL_PER_WOOD,
  ITEM_WEIGHT_KG,
} from '../balance';
import { weightOf } from '../items';
import { findPath, regionOf } from '../path/astar';
import { pick } from '../rng';
import { capacityKg } from '../skills';
import type { Action, Activity, Furniture, Survivor, World } from '../types';
import { tileOf } from '../world';
import { atOrBeside, standBeside } from './stand';

type FuelActivity = Extract<Activity, { type: 'takeFuel' | 'fuel' }>;

/** La hoguera a la que lleva leña (o va a por ella), o `null`. */
export function fuelTarget(s: Survivor): number | null {
  const a = s.action;
  const t = a.type === 'moveTo' ? a.then : undefined;
  return t?.type === 'takeFuel' || t?.type === 'fuel' ? t.fireId : null;
}

/** Las tablas que le harían falta para llenarla. */
const woodFor = (f: Furniture) => Math.ceil((CAMPFIRE_FUEL_MAX - (f.fuel ?? 0)) / FUEL_PER_WOOD);

/** La hoguera con poca leña más cercana, a la que llega y a la que nadie lleva ya. */
function fireToFeed(s: Survivor, w: World): Furniture | null {
  const busy = new Set(w.survivors.filter((o) => o !== s).map(fuelTarget));
  const at = tileOf(s.pos);
  const region = regionOf(w.grid, at.x, at.y);
  let best: Furniture | null = null;
  let bestD = Infinity;
  for (const f of w.furniture) {
    if (f.kind !== 'campfire' || f.fuel === undefined || f.fuel >= CAMPFIRE_REFUEL_BELOW) continue;
    if (busy.has(f.id)) continue;
    const d = (f.pos.x - at.x) ** 2 + (f.pos.y - at.y) ** 2;
    if (d >= bestD) continue;
    const stand = standBeside(w, s, f.pos);
    if (!stand || regionOf(w.grid, stand.x, stand.y) !== region) continue;
    best = f;
    bestD = d;
  }
  return best;
}

/** Si hay una hoguera que alimentar y tablas en el almacén, va a por ellas. */
export function fuelJob(s: Survivor, w: World): Action | null {
  if (w.storage.items.wood === 0) return null;
  const fire = fireToFeed(s, w);
  if (!fire) return null;
  return {
    type: 'moveTo',
    target: pick(w.rng, w.storage.tiles),
    then: { type: 'takeFuel', fireId: fire.id },
  };
}

/** ¿Sigue teniendo sentido? (Sin permiso para Transportar, o la hoguera ya no está, no.) */
export function fuelStillWorth(s: Survivor, w: World): boolean {
  const id = fuelTarget(s);
  if (id === null || !s.work.haul) return false;
  const f = w.furniture.find((x) => x.id === id);
  if (!f || f.fuel === undefined) return false;
  const a = s.action;
  return a.type === 'moveTo' && a.then?.type === 'takeFuel'
    ? w.storage.items.wood > 0 && f.fuel < CAMPFIRE_REFUEL_BELOW
    : s.carrying.wood > 0;
}

/** En el almacén coge las tablas; junto a la hoguera, las echa (y se gastan). */
export function startFuelActivity(s: Survivor, w: World, activity: FuelActivity): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const f = w.furniture.find((x) => x.id === activity.fireId);
  if (!f || f.kind !== 'campfire' || f.fuel === undefined) return idle;
  if (activity.type === 'takeFuel') {
    const fit = Math.floor((capacityKg(s) - weightOf(s.carrying)) / ITEM_WEIGHT_KG.wood + 1e-9);
    const n = Math.min(w.storage.items.wood, woodFor(f), fit);
    if (n < 1) return idle;
    w.storage.items.wood -= n;
    s.carrying.wood += n;
    const stand = standBeside(w, s, f.pos);
    const path = stand && findPath(w.grid, tileOf(s.pos), stand);
    if (!stand || !path) return idle;
    s.path = path;
    return { type: 'moveTo', target: stand, then: { type: 'fuel', fireId: f.id } };
  }
  if (!atOrBeside(s, f.pos)) return idle;
  const n = Math.min(s.carrying.wood, woodFor(f));
  s.carrying.wood -= n;
  f.fuel = Math.min(CAMPFIRE_FUEL_MAX, f.fuel + n * FUEL_PER_WOOD);
  w.common.woodLog.spent += n; // se quema
  return idle;
}
