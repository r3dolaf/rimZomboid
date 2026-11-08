// Comida (spec V1 §1 y §5): lo que quita cada una, en qué orden se come y comerla.
import { EAT_RESTORE, MEAL_RESTORE, VEG_RESTORE } from './balance';
import { has, spend } from './bags';
import type { ItemKind } from './items';
import type { Survivor } from './types';

export type FoodKind = 'meal' | 'veg' | 'food';

/** En el orden en que se come: lo que se estropea antes, primero (la lata no se estropea). */
export const FOODS: readonly FoodKind[] = ['meal', 'veg', 'food'];

/** Lo que quita de hambre cada una. */
export const FOOD_RESTORE: Record<FoodKind, number> = {
  meal: MEAL_RESTORE,
  veg: VEG_RESTORE,
  food: EAT_RESTORE,
};

type Stacks = Record<ItemKind, number>;

/** Lo primero que se comería de ahí, o `null` si no hay comida. */
export const bestFood = (inv: Stacks): FoodKind | null => FOODS.find((k) => inv[k] > 0) ?? null;

export const hasFood = (inv: Stacks): boolean => bestFood(inv) !== null;

/** Toda la comida de ahí contada en latas, por lo que quita de hambre. */
export const foodUnits = (inv: Stacks): number =>
  FOODS.reduce((n, k) => n + (inv[k] * FOOD_RESTORE[k]) / EAT_RESTORE, 0);

/** Come lo primero que haya ahí: qué y lo que quita, o `null` si no había nada. */
export function eatFrom(inv: Stacks): { kind: FoodKind; restore: number } | null {
  const kind = bestFood(inv);
  if (!kind) return null;
  inv[kind]--;
  return { kind, restore: FOOD_RESTORE[kind] };
}

/** Lo primero que comería de lo que lleva (también en sus bolsas), o `null`. */
export const packFood = (s: Survivor): FoodKind | null => FOODS.find((k) => has(s, k) > 0) ?? null;

/** Comida que lleva encima, en latas. */
export const packFoodUnits = (s: Survivor): number =>
  FOODS.reduce((n, k) => n + (has(s, k) * FOOD_RESTORE[k]) / EAT_RESTORE, 0);

/** Come de lo que lleva (de las manos y luego de sus bolsas, como `spend`). */
export function eatFromPack(s: Survivor): { kind: FoodKind; restore: number } | null {
  const kind = packFood(s);
  if (!kind || spend(s, kind) !== 1) return null;
  return { kind, restore: FOOD_RESTORE[kind] };
}
