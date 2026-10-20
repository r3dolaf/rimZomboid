// Ayudas comunes a los sucesos.
import type { Survivor, World } from '../types';

/** Latas que hay en total: almacén y lo que llevan encima. */
export function totalFood(w: World): number {
  return w.storage.items.food + w.survivors.reduce((acc, s) => acc + s.carrying.food, 0);
}

/** Todas las parejas ordenadas (a, b) con a ≠ b. */
export function orderedPairs(w: World): [Survivor, Survivor][] {
  const out: [Survivor, Survivor][] = [];
  for (const a of w.survivors) for (const b of w.survivors) if (a !== b) out.push([a, b]);
  return out;
}

export function byId(w: World, id: number): Survivor | undefined {
  return w.survivors.find((s) => s.id === id);
}
