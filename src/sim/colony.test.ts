// Cifras de toda la colonia: si duermen todos (para pasar la noche a x6).
import { expect, test } from 'vitest';
import { allAsleep } from './colony';
import { emptyWorld } from './testing/fixtures';

test('duermen todos solo si todos están durmiendo (y hay alguien)', () => {
  const w = emptyWorld(10, 10);
  expect(w.survivors.length).toBeGreaterThan(0);
  expect(allAsleep(w)).toBe(false);
  for (const s of w.survivors) s.action = { type: 'sleep', inBed: true };
  expect(allAsleep(w)).toBe(true);
  w.survivors[0]!.action = { type: 'downed', until: 1e9 }; // un herido en el suelo, no
  expect(allAsleep(w)).toBe(false);
  w.survivors = [];
  expect(allAsleep(w)).toBe(false);
});
