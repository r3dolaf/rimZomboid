// Semilla, narrador y zombis de la partida: de la URL (?seed=123&narrador=caotico&zombis=muchos)
// o al azar.
import type { NarratorStyle, ZombieLevel } from '../sim/types';

const MAX_SEED = 4294967295;

/** La semilla escrita como texto, o `null` si no es un entero de 0 a 2³² − 1. */
export function seedFromText(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_SEED ? n : null;
}

export function parseSeed(search: string, fallback: () => number): number {
  const raw = new URLSearchParams(search).get('seed');
  return (raw === null ? null : seedFromText(raw)) ?? fallback();
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** El narrador en la dirección (en español, para que el enlace se entienda). */
const NARRATOR_PARAM: Record<NarratorStyle, string> = {
  calm: 'tranquilo',
  balanced: 'equilibrado',
  chaotic: 'caotico',
};

export function parseNarrator(search: string): NarratorStyle | null {
  const raw = new URLSearchParams(search).get('narrador');
  const found = (Object.keys(NARRATOR_PARAM) as NarratorStyle[]).find(
    (k) => NARRATOR_PARAM[k] === raw,
  );
  return found ?? null;
}

/** La opción Zombis en la dirección (en español). */
const ZOMBIES_PARAM: Record<ZombieLevel, string> = {
  few: 'pocos',
  normal: 'normal',
  many: 'muchos',
};

export function parseZombies(search: string): ZombieLevel | null {
  const raw = new URLSearchParams(search).get('zombis');
  const found = (Object.keys(ZOMBIES_PARAM) as ZombieLevel[]).find((k) => ZOMBIES_PARAM[k] === raw);
  return found ?? null;
}

/**
 * La dirección de una partida: conserva lo que hubiera (p. ej. `debug`) y pone semilla, narrador
 * y zombis.
 */
/** H6b: la dirección para seguir la partida guardada (sin semilla; con lo demás, como `debug`). */
export function loadUrl(search: string): string {
  const p = new URLSearchParams(search);
  for (const k of ['seed', 'narrador', 'zombis']) p.delete(k);
  p.set('load', '1');
  return `?${p.toString()}`;
}

export function startUrl(
  search: string,
  seed: number,
  style: NarratorStyle,
  zombies: ZombieLevel = 'normal',
): string {
  const p = new URLSearchParams(search);
  p.delete('load'); // H6b: una partida nueva, no la guardada
  p.set('seed', String(seed));
  p.set('narrador', NARRATOR_PARAM[style]);
  p.set('zombis', ZOMBIES_PARAM[zombies]);
  return `?${p.toString()}`;
}
