// Ayudas comunes a los sucesos.
import type { Survivor, World } from '../types';

export { totalFood } from '../colony';

/** Todas las parejas ordenadas (a, b) con a ≠ b. */
export function orderedPairs(w: World): [Survivor, Survivor][] {
  const out: [Survivor, Survivor][] = [];
  for (const a of w.survivors) for (const b of w.survivors) if (a !== b) out.push([a, b]);
  return out;
}

export function byId(w: World, id: number): Survivor | undefined {
  return w.survivors.find((s) => s.id === id);
}
