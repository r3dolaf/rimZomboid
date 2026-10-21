// Cifras de toda la colonia.
import { EAT_RESTORE, HUNGER_PER_DAY } from './balance';
import type { World } from './types';

/** Latas que hay en total: almacén y lo que llevan encima. */
export function totalFood(w: World): number {
  return w.storage.items.food + w.survivors.reduce((acc, s) => acc + s.carrying.food, 0);
}

/** Días de comida: latas entre lo que comen todos al día (cada uno, unas 70/60 latas). */
export function foodDays(w: World): number {
  const n = w.survivors.length;
  return n === 0 ? Infinity : totalFood(w) / ((n * HUNGER_PER_DAY) / EAT_RESTORE);
}
