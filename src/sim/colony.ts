// Cifras de toda la colonia.
import { EAT_RESTORE, HUNGER_PER_DAY } from './balance';
import { has } from './bags';
import type { World } from './types';

/** Latas que hay en total: almacén y lo que llevan encima (también en sus bolsas). */
export function totalFood(w: World): number {
  return w.storage.items.food + w.survivors.reduce((acc, s) => acc + has(s, 'food'), 0);
}

/** Días de comida: latas entre lo que comen todos al día (cada uno, unas 70/60 latas). */
export function foodDays(w: World): number {
  const n = w.survivors.length;
  return n === 0 ? Infinity : totalFood(w) / ((n * HUNGER_PER_DAY) / EAT_RESTORE);
}

/** Duermen todos, en todos los mapas (y hay alguien): el tiempo puede ir a x6. */
export function allAsleep(w: World): boolean {
  const all = [w, ...w.siteMaps.map((m) => m.world)].flatMap((m) => m.survivors);
  return all.length > 0 && all.every((s) => s.action.type === 'sleep');
}
