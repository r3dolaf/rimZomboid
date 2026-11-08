// Beber (spec V2 §2): de dónde y en qué orden. Lo que no se acaba (el fregadero con agua corriente),
// primero; luego los depósitos (barreño, barril de lluvia, cisterna); las botellas del almacén,
// para cuando no hay otra cosa; y las propias, fuera de la base o en último lugar.
import {
  DEPOT_DETOUR,
  DRINK_RESTORE,
  DRINK_TICKS,
  LOW_WATER_PER_COLONIST,
  NEAR_WATER,
  NO_WATER_WARN_HOURS,
  THIRSTY_BELOW,
  TICKS_PER_HOUR,
} from './balance';
import { logEvent } from './log';
import { has, spend } from './bags';
import { inBase, reachesStorage } from './jobs/medical';
import { standOnOrBeside } from './jobs/stand';
import { regionOf } from './path/astar';
import { pick } from './rng';
import type { Action, Furniture, Point, Survivor, World } from './types';
import { mainsOn } from './water';
import { tileOf } from './world';

/** Los muebles que guardan agua (y la dan de beber). */
export const DEPOTS: ReadonlySet<Furniture['kind']> = new Set(['tub', 'barrel', 'cistern']);

/** ¿Se puede beber ahí ahora? El fregadero, con agua corriente; un depósito, con un litro al menos. */
export const drinkable = (w: World, f: Furniture): boolean =>
  (f.kind === 'sink' && mainsOn(w)) || (DEPOTS.has(f.kind) && (f.water ?? 0) >= 1);

/** El sitio donde beber más a mano (los depósitos, como si estuvieran un poco más lejos). */
function nearestWater(s: Survivor, w: World): { f: Furniture; stand: Point; d: number } | null {
  const at = tileOf(s.pos);
  const region = regionOf(w.grid, at.x, at.y);
  let best: { f: Furniture; stand: Point; d: number } | null = null;
  for (const f of w.furniture) {
    if (!drinkable(w, f)) continue;
    const d = Math.sqrt((f.pos.x - at.x) ** 2 + (f.pos.y - at.y) ** 2);
    const cost = d + (f.kind === 'sink' ? 0 : DEPOT_DETOUR);
    if (best && cost >= best.d + (best.f.kind === 'sink' ? 0 : DEPOT_DETOUR)) continue;
    const stand = standOnOrBeside(w, s, f.pos);
    if (!stand || regionOf(w.grid, stand.x, stand.y) !== region) continue;
    best = { f, stand, d };
  }
  return best;
}

const fromPack = (): Action => ({
  type: 'drink',
  ticksLeft: DRINK_TICKS,
  sourceId: null,
  fromPack: true,
});

/** Qué hace para beber, o `null` si no hay dónde. */
export function drinkSomething(s: Survivor, w: World): Action | null {
  const water = nearestWater(s, w);
  const pack = has(s, 'waterBottle') > 0;
  const home = inBase(w, s);
  if (water && (water.d <= NEAR_WATER || !pack || home))
    return { type: 'moveTo', target: water.stand, then: { type: 'drink', sourceId: water.f.id } };
  if (pack && !home) return fromPack();
  if (water)
    return { type: 'moveTo', target: water.stand, then: { type: 'drink', sourceId: water.f.id } };
  if (w.storage.items.waterBottle > 0 && reachesStorage(w, s))
    return {
      type: 'moveTo',
      target: pick(w.rng, w.storage.tiles),
      then: { type: 'drink', sourceId: null },
    };
  return pack ? fromPack() : null;
}

/** ¿Sigue habiendo agua donde va a beber? (`null`: las botellas del almacén.) */
export function stillDrinkable(w: World, sourceId: number | null): boolean {
  if (sourceId === null) return w.storage.items.waterBottle > 0;
  const f = w.furniture.find((x) => x.id === sourceId);
  return f !== undefined && drinkable(w, f);
}

/** Al terminar de beber: un litro de donde sea, que sube la sed. Devuelve si ha bebido. */
export function finishDrink(
  w: World,
  s: Survivor,
  a: { sourceId: number | null; fromPack?: boolean },
): boolean {
  let drank = false;
  if (a.fromPack) drank = spend(s, 'waterBottle') === 1;
  else if (a.sourceId === null) {
    drank = w.storage.items.waterBottle > 0;
    if (drank) w.storage.items.waterBottle--;
  } else {
    const f = w.furniture.find((x) => x.id === a.sourceId);
    drank = f !== undefined && drinkable(w, f);
    if (drank && f!.kind !== 'sink') f!.water = (f!.water ?? 0) - 1;
  }
  if (drank) s.needs.thirst = Math.min(100, s.needs.thirst + DRINK_RESTORE);
  return drank;
}

/** El agua guardada en la base (V2 §7): litros en barreños y barriles, y botellas del almacén. */
export function baseWater(w: World): { liters: number; bottles: number; mains: boolean } {
  let liters = 0;
  for (const f of w.furniture)
    if (f.kind === 'tub' || f.kind === 'barrel') liters += Math.floor(f.water ?? 0);
  return { liters, bottles: w.storage.items.waterBottle, mains: mainsOn(w) };
}

/**
 * Cada hora, en la base: sin agua corriente y con menos de LOW_WATER_PER_COLONIST litros por persona
 * (contando las botellas), se avisa una vez, hasta que vuelva a haber.
 */
export function lowWaterSystem(w: World): void {
  if (w.mapId !== 0 || w.tick % TICKS_PER_HOUR !== 0 || w.survivors.length === 0) return;
  const { liters, bottles, mains } = baseWater(w);
  const low = !mains && liters + bottles < LOW_WATER_PER_COLONIST * w.survivors.length;
  if (low && !w.waterLow) logEvent(w, { kind: 'lowWater' });
  w.waterLow = low;
}

/** Con mucha sed y sin dónde beber, se avisa (como mucho cada NO_WATER_WARN_HOURS por persona). */
export function warnNoWater(s: Survivor, w: World): void {
  if (s.needs.thirst >= THIRSTY_BELOW) return;
  if (s.noWaterAt !== undefined && w.tick < s.noWaterAt + NO_WATER_WARN_HOURS * TICKS_PER_HOUR)
    return;
  s.noWaterAt = w.tick;
  logEvent(w, { kind: 'noWater', survivorId: s.id });
}
