// Las estaciones y la temperatura (spec V3 §1–§2). Todo se deduce del tick y de la semilla: no hay
// estado (salvo una ola de frío o de calor, `Common.tempShift`) ni se toca el azar de la partida.
import {
  CAMPFIRE_RANGE,
  FREEZING_BELOW,
  FEELS_EVERY_TICKS,
  GARMENT_WARMTH,
  HOLE_WARMTH_LOSS,
  FIRE_WARMTH,
  INDOOR_DOWN,
  INDOOR_TARGET,
  INDOOR_UP,
  SEASON_DAYS,
  START_HOUR,
  TEMP_COLDEST_HOUR,
  TEMP_DAY_NOISE,
  TEMP_DAY_SWING,
  TEMP_MEAN,
  TEMP_RAIN,
  TEMP_STORM,
  TEMP_SWING,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  YEAR_DAYS,
  SOUP_WARMTH,
  TRAIT_WARMTH,
} from './balance';
import { gameTime } from './clock';
import { logEvent } from './log';
import { baseFloor } from './base';
import { isLitFire } from './furniture';
import { standBeside } from './jobs/stand';
import { pick } from './rng';
import { coldShift } from './setup';
import type { Action, Garment, Point, Survivor, World } from './types';
import { tileOf } from './world';
import { isRaining } from './water';
import { indoors } from './zombies/spawn';

export type Season = 'summer' | 'autumn' | 'winter' | 'spring';
/** En orden: la partida empieza el primer día del verano. */
export const SEASONS: readonly Season[] = ['summer', 'autumn', 'winter', 'spring'];

/** La estación de un tick. */
export function seasonOf(tick: number): Season {
  const day = gameTime(tick).day;
  return SEASONS[Math.floor((day - 1) / SEASON_DAYS) % SEASONS.length]!;
}

/** Días desde el principio de la partida (con decimales: el día 1 a las 00:00 es 0). */
const daysAt = (tick: number) => (tick + START_HOUR * TICKS_PER_HOUR) / TICKS_PER_DAY;

/** La media del año para ese momento: el máximo a mitad del verano, el mínimo a mitad del invierno. */
export function yearMean(days: number): number {
  const peak = SEASON_DAYS / 2;
  return TEMP_MEAN + TEMP_SWING * Math.cos((2 * Math.PI * (days - peak)) / YEAR_DAYS);
}

/** Lo que se aparta de la media el día `day` (de −1 a 1), con la semilla, sin tocar el azar. */
function noise(seed: number, day: number): number {
  let h = Math.imul(seed ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul(day + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
  h ^= h >>> 13;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** La ola de frío o de calor en curso (grados), o 0; y el ajuste Frío (C2). */
const shift = (w: World, tick: number) =>
  (w.common.tempShift && tick < w.common.tempShift.until ? w.common.tempShift.value : 0) +
  coldShift(w); // C2: el ajuste Frío

/** La media del día (sin la hora ni la lluvia): para vestirse, el huerto y lo que se estropea. */
export function dayMean(w: World, tick = w.tick): number {
  const day = Math.floor(daysAt(tick));
  return yearMean(day + 0.5) + TEMP_DAY_NOISE * noise(w.seed, day) + shift(w, tick);
}

/** La temperatura al aire libre en ese momento. */
export function outdoorTemp(w: World, tick = w.tick): number {
  const days = daysAt(tick);
  const day = Math.floor(days);
  const f = days - day;
  const dayNoise = noise(w.seed, day) * (1 - f) + noise(w.seed, day + 1) * f;
  const hour = f * 24;
  const daily = -TEMP_DAY_SWING * Math.cos((2 * Math.PI * (hour - TEMP_COLDEST_HOUR)) / 24);
  const weather = tick < w.common.stormUntil ? TEMP_STORM : isRaining(w) ? TEMP_RAIN : 0;
  return yearMean(days) + TEMP_DAY_NOISE * dayNoise + daily + weather + shift(w, tick);
}

/** ¿Hay una hoguera encendida a CAMPFIRE_RANGE casillas o menos? */
export function nearLitFire(w: World, p: Point): boolean {
  const r2 = CAMPFIRE_RANGE * CAMPFIRE_RANGE;
  return w.furniture.some((f) => isLitFire(f) && (f.pos.x - p.x) ** 2 + (f.pos.y - p.y) ** 2 <= r2);
}

/** La temperatura de una casilla: la de fuera, bajo techo más templada, y junto al fuego, más. */
export function tempAt(w: World, p: Point, outside = outdoorTemp(w)): number {
  let t = outside;
  if (indoors(w, p.x, p.y)) t += Math.max(-INDOOR_DOWN, Math.min(INDOOR_UP, INDOOR_TARGET - t));
  if (nearLitFire(w, p)) t += FIRE_WARMTH;
  return t;
}

/** ¿Empieza una estación en este tick? (A las 00:00 de su primer día; la primera, no.) */
export function seasonStarts(tick: number): Season | null {
  const total = tick + START_HOUR * TICKS_PER_HOUR;
  if (total % TICKS_PER_DAY !== 0) return null;
  const day = total / TICKS_PER_DAY + 1;
  return day > 1 && (day - 1) % SEASON_DAYS === 0 ? seasonOf(tick) : null;
}

/** Al empezar cada estación, el registro lo dice (en la base). */
export function seasonSystem(w: World): void {
  if (w.mapId !== 0) return;
  const season = seasonStarts(w.tick);
  if (season) logEvent(w, { kind: 'season', season });
}

/** Lo que abriga la ropa puesta (V3 §3): cada prenda, menos un 20 % por agujero. */
export function warmthOf(worn: readonly Garment[]): number {
  return worn.reduce(
    (n, g) => n + GARMENT_WARMTH[g.kind] * Math.max(0, 1 - HOLE_WARMTH_LOSS * g.holes.length),
    0,
  );
}

/**
 * V4 §4: el calor de la sopa, mientras le dure; R1: y el de su rasgo (el Caluroso siente más, el
 * Friolero menos).
 */
export const extraWarmth = (s: Survivor, tick: number): number =>
  ((s.warmUntil ?? 0) > tick ? SOUP_WARMTH : 0) +
  (s.traits.includes('warmBlooded')
    ? TRAIT_WARMTH
    : s.traits.includes('chilly')
      ? -TRAIT_WARMTH
      : 0);

/** Cada pocos ticks, la sensación térmica de cada colono del mapa. */
export function feelsSystem(w: World): void {
  if (w.tick % FEELS_EVERY_TICKS !== 0 || w.survivors.length === 0) return;
  const outside = outdoorTemp(w);
  for (const s of w.survivors)
    s.feels = tempAt(w, tileOf(s.pos), outside) + warmthOf(s.worn) + extraWarmth(s, w.tick);
}

/**
 * Helado (V3 §3), va a calentarse: junto a la hoguera encendida más cercana a la que llega o, si no
 * hay, a la base (bajo techo). Junto al fuego o ya bajo techo sin hoguera, no hace nada.
 */
export function warmUpDecision(s: Survivor, w: World): Action | null {
  if (s.feels === undefined || s.feels >= FREEZING_BELOW) return null;
  const here = tileOf(s.pos);
  if (nearLitFire(w, here)) return null;
  let best: { stand: Point; d: number } | null = null;
  for (const f of w.furniture) {
    if (!isLitFire(f)) continue;
    const d = (f.pos.x - here.x) ** 2 + (f.pos.y - here.y) ** 2;
    if (best && d >= best.d) continue;
    const stand = standBeside(w, s, f.pos);
    if (stand) best = { stand, d };
  }
  if (best) return { type: 'moveTo', target: best.stand, then: { type: 'warmUp' } };
  if (indoors(w, here.x, here.y) || w.mapId !== 0) return null;
  const floor = baseFloor(w);
  return floor.length > 0
    ? { type: 'moveTo', target: pick(w.rng, floor), then: { type: 'warmUp' } }
    : null;
}
