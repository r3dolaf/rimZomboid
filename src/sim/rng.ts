// Generador de números aleatorios con semilla (mulberry32).
// El estado es un objeto plano para que la partida se pueda guardar con JSON.

export interface RngState {
  s: number;
}

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

/** Número en [0, 1). Avanza el estado. */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entero en [min, max], ambos incluidos. */
export function nextInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: la lista está vacía');
  return items[nextInt(rng, 0, items.length - 1)]!;
}

/** Una clave al azar con probabilidad proporcional a su peso (los pesos ≤ 0 no salen). */
export function weightedPick<K extends string>(rng: RngState, weights: Record<K, number>): K {
  const keys = Object.keys(weights) as K[];
  const total = keys.reduce((acc, k) => acc + Math.max(0, weights[k]), 0);
  if (total <= 0) throw new Error('weightedPick: todos los pesos son 0');
  let r = nextFloat(rng) * total;
  let last = keys[0]!;
  for (const k of keys) {
    if (weights[k] <= 0) continue;
    last = k;
    r -= weights[k];
    if (r < 0) return k;
  }
  return last; // por redondeo, r puede quedarse en 0 al final
}
