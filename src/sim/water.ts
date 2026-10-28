// Agua (spec H5b §6): fregaderos con agua corriente (hasta que se corta), cisternas, lluvia y el
// barreño.
import {
  CISTERN_IN,
  CISTERN_LITERS,
  RAIN_CISTERN_LITERS,
  RAIN_TUB_LITERS,
  SINK_IN,
  START_HOUR,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  TUB_LITERS,
  WATER_CUT_DAY_MAX,
  WATER_CUT_DAY_MIN,
} from './balance';
import { logEvent } from './log';
import { wallSpots } from './map/recipes';
import { nextInt, type RngState } from './rng';
import type { Building, Container, Furniture, Grid, World } from './types';
import { indoors } from './zombies/spawn';

/** ¿Sigue habiendo agua corriente? */
export const mainsOn = (w: World): boolean => w.tick < w.waterCutAt;

/** Cuándo se corta el agua: un día entre el 7 y el 14, a una hora al azar. */
export function rollWaterCut(rng: RngState): number {
  const day = nextInt(rng, WATER_CUT_DAY_MIN, WATER_CUT_DAY_MAX);
  const hour = nextInt(rng, 0, 23);
  return (day - 1) * TICKS_PER_DAY + hour * TICKS_PER_HOUR - START_HOUR * TICKS_PER_HOUR;
}

/**
 * Los fregaderos y las cisternas de los edificios (uno de cada, según el tipo), junto a una pared
 * libre de muebles de saqueo; las cisternas, llenas. Con ids desde `firstId`.
 */
export function placeFixtures(
  grid: Grid,
  houses: Building[],
  containers: Container[],
  rng: RngState,
  firstId: number,
): Furniture[] {
  const out: Furniture[] = [];
  const used = new Set(containers.map((c) => `${c.pos.x},${c.pos.y}`));
  for (const h of houses) {
    if (h.kind === 'base') continue;
    const kinds: Furniture['kind'][] = [];
    if (SINK_IN.includes(h.kind)) kinds.push('sink');
    if (CISTERN_IN.includes(h.kind)) kinds.push('cistern');
    for (const kind of kinds) {
      const free = wallSpots(grid, h).filter((p) => !used.has(`${p.x},${p.y}`));
      if (free.length === 0) continue;
      const pos = free[nextInt(rng, 0, free.length - 1)]!;
      used.add(`${pos.x},${pos.y}`);
      out.push({
        id: firstId + out.length,
        kind,
        pos,
        ...(kind === 'cistern' ? { water: CISTERN_LITERS } : {}),
      });
    }
  }
  return out;
}

/** ¿Llueve? (Con tormenta, también.) */
export const isRaining = (w: World): boolean => w.tick < w.rainUntil;

/**
 * Al cortarse el agua corriente, se avisa. Cada hora de lluvia: los cubos vacíos de los montones
 * al aire libre se llenan, las cisternas suben y el barreño de fuera también.
 */
export function waterSystem(w: World): void {
  if (w.tick === w.waterCutAt) logEvent(w, { kind: 'waterCut' });
  if (!isRaining(w) || w.tick % TICKS_PER_HOUR !== 0) return;
  for (const p of w.piles) {
    if (p.items.bucket === 0 || indoors(w, p.pos.x, p.pos.y)) continue;
    p.items.waterBucket += p.items.bucket;
    p.items.bucket = 0;
  }
  for (const f of w.furniture) {
    if (f.kind === 'cistern')
      f.water = Math.min(CISTERN_LITERS, (f.water ?? 0) + RAIN_CISTERN_LITERS);
    else if (f.kind === 'tub' && !indoors(w, f.pos.x, f.pos.y))
      f.water = Math.min(TUB_LITERS, (f.water ?? 0) + RAIN_TUB_LITERS);
  }
}
