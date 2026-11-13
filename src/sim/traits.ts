import { isNight } from './clock';
import { nextInt, pick, type RngState } from './rng';
import type { Survivor, TraitId } from './types';

/** R1: ¿es su hora de dormir? La noche; al Nocturno, el día. */
export const sleepTime = (s: Survivor, tick: number): boolean =>
  s.traits.includes('nightOwl') ? !isNight(tick) : isNight(tick);

export const TRAITS: readonly TraitId[] = [
  'brave',
  'coward',
  'glutton',
  'sleepyhead',
  'optimist',
  'pessimist',
  // Habilidades (H4c)
  'handy',
  'clumsy',
  'strong',
  'weak',
  'fastLearner',
  'slowLearner',
  'pleasant',
  'unpleasant',
  'keenEye',
  // Estilo (H5b)
  'vain',
  'slob',
  'practical',
  // R1: los que cambian lo que hacen
  'nightOwl',
  'greenThumb',
  'cook',
  'gourmet',
  'ascetic',
  'sharpshooter',
  'triggerHappy',
  'tough',
  'sickly',
  'chilly',
  'warmBlooded',
];

/** Parejas que no pueden darse juntas. */
export const INCOMPATIBLE: readonly (readonly [TraitId, TraitId])[] = [
  ['brave', 'coward'],
  ['optimist', 'pessimist'],
  ['handy', 'clumsy'],
  ['strong', 'weak'],
  ['fastLearner', 'slowLearner'],
  ['pleasant', 'unpleasant'],
  ['vain', 'slob'],
  ['gourmet', 'ascetic'], // R1
  ['sharpshooter', 'triggerHappy'],
  ['tough', 'sickly'],
  ['chilly', 'warmBlooded'],
];

function compatible(a: TraitId, b: TraitId): boolean {
  return a !== b && !INCOMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** 1–2 rasgos al azar, sin repetir y sin parejas incompatibles. */
export function rollTraits(rng: RngState): TraitId[] {
  const count = nextInt(rng, 1, 2);
  const chosen: TraitId[] = [];
  for (let i = 0; i < count; i++) {
    const options = TRAITS.filter((t) => chosen.every((c) => compatible(c, t)));
    chosen.push(pick(rng, options));
  }
  return chosen;
}
