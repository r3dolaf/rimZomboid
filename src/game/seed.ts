// Semilla de la partida: de la URL (?seed=123) o al azar.

const MAX_SEED = 4294967295;

export function parseSeed(search: string, fallback: () => number): number {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^\d+$/.test(raw)) return fallback();
  const n = Number(raw);
  return n <= MAX_SEED ? n : fallback();
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
