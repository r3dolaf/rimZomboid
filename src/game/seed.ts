// Semilla, narrador y zombis de la partida: de la URL (?seed=123&narrador=caotico&zombis=muchos)
// o al azar. C2: también el comienzo y los ajustes que no son normales (&comienzo=solo&frio=duro).
import { DEFAULT_SETUP } from '../sim/setup';
import type { GameSetup, NarratorStyle, ScenarioId, SetupLevel, ZombieLevel } from '../sim/types';

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

/** C2: el comienzo en la dirección (en español). */
const SCENARIO_PARAM: Record<ScenarioId, string> = {
  town: 'pueblo',
  solo: 'solo',
  family: 'familia',
  bare: 'con-lo-puesto',
};

/** C2: cada ajuste en la dirección: su nombre y lo que dicen «menos» y «más». */
const SETUP_PARAMS = {
  infection: { key: 'infeccion', low: 'baja', high: 'alta' },
  loot: { key: 'botin', low: 'escaso', high: 'abundante' },
  sieges: { key: 'asedios', low: 'pocos', high: 'muchos' },
  needs: { key: 'hambre', low: 'menos', high: 'mas' },
  cold: { key: 'frio', low: 'suave', high: 'duro' },
} as const;
type SetupKey = keyof typeof SETUP_PARAMS;
const SETUP_KEYS = Object.keys(SETUP_PARAMS) as SetupKey[];
const URL_SETUP_KEYS = ['comienzo', ...SETUP_KEYS.map((k) => SETUP_PARAMS[k].key)];

/** C2: el comienzo y los ajustes de la dirección (lo que falta o no se entiende, lo normal). */
export function parseSetup(search: string): GameSetup {
  const p = new URLSearchParams(search);
  const raw = p.get('comienzo');
  const scenario =
    (Object.keys(SCENARIO_PARAM) as ScenarioId[]).find((k) => SCENARIO_PARAM[k] === raw) ??
    DEFAULT_SETUP.scenario;
  const out: GameSetup = { ...DEFAULT_SETUP, scenario };
  for (const k of SETUP_KEYS) {
    const v = p.get(SETUP_PARAMS[k].key);
    const level: SetupLevel =
      v === SETUP_PARAMS[k].low ? 'low' : v === SETUP_PARAMS[k].high ? 'high' : 'normal';
    out[k] = level;
  }
  return out;
}

/**
 * La dirección de una partida: conserva lo que hubiera (p. ej. `debug`) y pone semilla, narrador
 * y zombis; C2: y el comienzo y los ajustes que no son normales (los demás, fuera).
 */
/** H6b: la dirección para seguir la partida guardada (sin semilla; con lo demás, como `debug`). */
export function loadUrl(search: string): string {
  const p = new URLSearchParams(search);
  for (const k of ['seed', 'narrador', 'zombis', ...URL_SETUP_KEYS]) p.delete(k);
  p.set('load', '1');
  return `?${p.toString()}`;
}

export function startUrl(
  search: string,
  seed: number,
  style: NarratorStyle,
  zombies: ZombieLevel = 'normal',
  setup: GameSetup = DEFAULT_SETUP,
): string {
  const p = new URLSearchParams(search);
  p.delete('load'); // H6b: una partida nueva, no la guardada
  for (const k of URL_SETUP_KEYS) p.delete(k);
  p.set('seed', String(seed));
  p.set('narrador', NARRATOR_PARAM[style]);
  p.set('zombis', ZOMBIES_PARAM[zombies]);
  if (setup.scenario !== 'town') p.set('comienzo', SCENARIO_PARAM[setup.scenario]);
  for (const k of SETUP_KEYS) {
    const v = setup[k];
    if (v !== 'normal') p.set(SETUP_PARAMS[k].key, SETUP_PARAMS[k][v]);
  }
  return `?${p.toString()}`;
}
