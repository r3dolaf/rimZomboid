// Comida (spec V1 §1 y §5): lo que quita cada una, en qué orden se come y comerla.
import { EAT_RESTORE, ROT_PER_DAY, SOUP_WARM_HOURS, TICKS_PER_HOUR, VARIETY } from './balance';
import { addMemory } from './mood';
import { has, spend } from './bags';
import type { ItemKind } from './items';
import type { Survivor, World } from './types';

export type FoodKind =
  | 'salad'
  | 'stewVeg'
  | 'stewPotato'
  | 'soupCabbage'
  | 'lettuce'
  | 'tomato'
  | 'cabbage'
  | 'potato'
  | 'preserves'
  | 'food';

/**
 * En el orden en que se come (V4 §4): lo que antes se estropea, primero; los platos antes que lo
 * crudo, y la conserva y la lata (que no se estropean) al final.
 */
export const FOODS: readonly FoodKind[] = [
  'salad',
  'stewVeg',
  'stewPotato',
  'soupCabbage',
  'lettuce',
  'tomato',
  'cabbage',
  'potato',
  'preserves',
  'food',
];

/** Lo que quita de hambre cada una (V4 §2–§3; la lata, EAT_RESTORE). */
export const FOOD_RESTORE: Record<FoodKind, number> = {
  salad: 50,
  stewVeg: 80,
  stewPotato: 100,
  soupCabbage: 60,
  lettuce: 25,
  tomato: 20,
  cabbage: 35,
  potato: 40,
  preserves: 60,
  food: EAT_RESTORE,
};

type Stacks = Record<ItemKind, number>;

/** Lo que se estropea al día (la conserva y la lata, nada). */
const rotOf = (k: FoodKind): number => (ROT_PER_DAY as Partial<Record<FoodKind, number>>)[k] ?? 0;

/**
 * Lo primero que se comería de ahí, o `null` si no hay comida. V4 §4: entre los que se estropean
 * igual que ese, mejor uno que no sea `last` (lo que comió la última vez).
 */
export function bestFood(inv: Stacks, last?: FoodKind): FoodKind | null {
  const first = FOODS.find((k) => inv[k] > 0) ?? null;
  if (first === null || first !== last) return first;
  return FOODS.find((k) => k !== last && inv[k] > 0 && rotOf(k) === rotOf(first)) ?? first;
}

export const hasFood = (inv: Stacks): boolean => bestFood(inv) !== null;

/** Toda la comida de ahí contada en latas, por lo que quita de hambre. */
export const foodUnits = (inv: Stacks): number =>
  FOODS.reduce((n, k) => n + (inv[k] * FOOD_RESTORE[k]) / EAT_RESTORE, 0);

/** Come lo primero que haya ahí: qué y lo que quita, o `null` si no había nada. */
export function eatFrom(inv: Stacks, last?: FoodKind): { kind: FoodKind; restore: number } | null {
  const kind = bestFood(inv, last);
  if (!kind) return null;
  inv[kind]--;
  return { kind, restore: FOOD_RESTORE[kind] };
}

/** Lo primero que comería de lo que lleva (también en sus bolsas), o `null`. */
export function packFood(s: Survivor, last?: FoodKind): FoodKind | null {
  const inv = Object.fromEntries(FOODS.map((k) => [k, has(s, k)])) as Stacks;
  return bestFood(inv, last);
}

/** Comida que lleva encima, en latas. */
export const packFoodUnits = (s: Survivor): number =>
  FOODS.reduce((n, k) => n + (has(s, k) * FOOD_RESTORE[k]) / EAT_RESTORE, 0);

/** Come de lo que lleva (de las manos y luego de sus bolsas, como `spend`). */
export function eatFromPack(
  s: Survivor,
  last?: FoodKind,
): { kind: FoodKind; restore: number } | null {
  const kind = packFood(s, last);
  if (!kind || spend(s, kind) !== 1) return null;
  return { kind, restore: FOOD_RESTORE[kind] };
}

/** Lo último que comió `s`, o nada. */
export const lastAte = (s: Survivor): FoodKind | undefined => s.ate?.at(-1);

/**
 * V4 §4: después de comer algo: lo recuerda (las últimas VARIETY.remember), la partida apunta cada
 * cosa comida, el recuerdo que deja (los guisos y la sopa, comida caliente; la ensalada, algo fresco;
 * lo demás, «ha comido») y la sopa hace entrar en calor.
 */
export function ateFood(w: World, s: Survivor, kind: FoodKind): void {
  s.ate = [...(s.ate ?? []), kind].slice(-VARIETY.remember);
  const stats = w.common.stats;
  if (!(stats.eaten ?? []).includes(kind)) stats.eaten = [...(stats.eaten ?? []), kind];
  const hot = kind === 'stewVeg' || kind === 'stewPotato' || kind === 'soupCabbage';
  addMemory(s, hot ? 'hotMeal' : kind === 'salad' ? 'freshFood' : 'ate', w.tick);
  if (kind === 'soupCabbage') s.warmUntil = w.tick + SOUP_WARM_HOURS * TICKS_PER_HOUR;
}
