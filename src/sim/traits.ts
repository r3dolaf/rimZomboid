import { nextInt, pick, type RngState } from './rng';
import type { TraitId } from './types';

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
