// Leña para las hogueras (spec V3 §4), en Transportar: a la que le quedan menos de 8 horas se le
// llevan tablas del almacén hasta 24 (cada tabla, 4 horas). C1: lo mismo con las pilas de la radio
// (con menos de 6 horas, hasta 24; cada pila, 6 horas).
import {
  CAMPFIRE_FUEL_MAX,
  CAMPFIRE_REFUEL_BELOW,
  CHARGE_PER_BATTERY,
  FUEL_PER_WOOD,
  GEN_FUEL_MAX,
  GEN_FUEL_PER_CAN,
  GEN_REFUEL_BELOW,
  ITEM_WEIGHT_KG,
  RADIO_CHARGE_MAX,
  RADIO_RECHARGE_BELOW,
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

/** Lo que gasta cada mueble: qué, cuántas horas da cada uno, hasta cuántas y por debajo de cuántas. */
const FUELS = {
  campfire: {
    item: 'wood',
    per: FUEL_PER_WOOD,
    max: CAMPFIRE_FUEL_MAX,
    below: CAMPFIRE_REFUEL_BELOW,
  },
  radio: {
    item: 'battery',
    per: CHARGE_PER_BATTERY,
    max: RADIO_CHARGE_MAX,
    below: RADIO_RECHARGE_BELOW,
  },
  // E1: el generador, con bidones de gasolina.
  generator: {
    item: 'gasCan',
    per: GEN_FUEL_PER_CAN,
    max: GEN_FUEL_MAX,
    below: GEN_REFUEL_BELOW,
  },
} as const;
type Fuel = (typeof FUELS)[keyof typeof FUELS];

/** Lo que gasta ese mueble, o `undefined` (también la hoguera de antes, sin leña que contar). */
const fuelOf = (f: Furniture): Fuel | undefined =>
  f.fuel === undefined
    ? undefined
    : f.kind === 'campfire' || f.kind === 'radio' || f.kind === 'generator'
      ? FUELS[f.kind]
      : undefined;

/** Lo que le haría falta para llenarlo. */
const unitsFor = (f: Furniture, fuel: Fuel) => Math.ceil((fuel.max - (f.fuel ?? 0)) / fuel.per);

/** El mueble con poco más cercano, con qué llenarlo en el almacén, al que llega y nadie lleva ya. */
function fireToFeed(s: Survivor, w: World): Furniture | null {
  const busy = new Set(w.survivors.filter((o) => o !== s).map(fuelTarget));
  const at = tileOf(s.pos);
  const region = regionOf(w.grid, at.x, at.y);
  let best: Furniture | null = null;
  let bestD = Infinity;
  for (const f of w.furniture) {
    const fuel = fuelOf(f);
    if (!fuel || f.fuel! >= fuel.below || w.storage.items[fuel.item] === 0) continue;
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

/** Si hay una hoguera (o una radio) que llenar y con qué en el almacén, va a por ello. */
export function fuelJob(s: Survivor, w: World): Action | null {
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
  const fuel = f && fuelOf(f);
  if (!f || !fuel) return false;
  const a = s.action;
  return a.type === 'moveTo' && a.then?.type === 'takeFuel'
    ? w.storage.items[fuel.item] > 0 && f.fuel! < fuel.below
    : s.carrying[fuel.item] > 0;
}

/** En el almacén coge las tablas (o las pilas); junto al mueble, las echa (y se gastan). */
export function startFuelActivity(s: Survivor, w: World, activity: FuelActivity): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const f = w.furniture.find((x) => x.id === activity.fireId);
  const fuel = f && fuelOf(f);
  if (!f || !fuel) return idle;
  const item = fuel.item;
  if (activity.type === 'takeFuel') {
    const fit = Math.floor((capacityKg(s) - weightOf(s.carrying)) / ITEM_WEIGHT_KG[item] + 1e-9);
    const n = Math.min(w.storage.items[item], unitsFor(f, fuel), fit);
    if (n < 1) return idle;
    w.storage.items[item] -= n;
    s.carrying[item] += n;
    const stand = standBeside(w, s, f.pos);
    const path = stand && findPath(w.grid, tileOf(s.pos), stand);
    if (!stand || !path) return idle;
    s.path = path;
    return { type: 'moveTo', target: stand, then: { type: 'fuel', fireId: f.id } };
  }
  if (!atOrBeside(s, f.pos)) return idle;
  const n = Math.min(s.carrying[item], unitsFor(f, fuel));
  s.carrying[item] -= n;
  f.fuel = Math.min(fuel.max, f.fuel! + n * fuel.per);
  if (item === 'wood') w.common.woodLog.spent += n; // se quema
  return idle;
}
