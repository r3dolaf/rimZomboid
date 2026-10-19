import { expect, test } from 'vitest';
import { createRng } from './rng';
import { INCOMPATIBLE, rollTraits, TRAITS } from './traits';

test('entre 1 y 2 rasgos válidos, sin repetir ni incompatibles, en 500 tiradas', () => {
  const rng = createRng(11);
  const seenCounts = new Set<number>();
  for (let i = 0; i < 500; i++) {
    const t = rollTraits(rng);
    seenCounts.add(t.length);
    expect(t.length >= 1 && t.length <= 2).toBe(true);
    expect(new Set(t).size).toBe(t.length);
    for (const x of t) expect(TRAITS).toContain(x);
    for (const [a, b] of INCOMPATIBLE) expect(t.includes(a) && t.includes(b)).toBe(false);
  }
  expect([...seenCounts].sort()).toEqual([1, 2]);
});

test('todos los rasgos acaban saliendo', () => {
  const rng = createRng(3);
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) rollTraits(rng).forEach((t) => seen.add(t));
  expect(seen.size).toBe(TRAITS.length);
});
