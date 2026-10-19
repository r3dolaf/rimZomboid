import { expect, test } from 'vitest';
import { createWorld } from '../sim/world';
import { survivorAt } from './pick';

test('encuentra al superviviente más cercano dentro del radio', () => {
  const w = createWorld(2);
  const s = w.survivors[1]!;
  expect(survivorAt(w, s.pos.x + 0.3, s.pos.y - 0.2, 0.6)?.id).toBe(s.id);
});

test('fuera del radio no encuentra a nadie', () => {
  const w = createWorld(2);
  expect(survivorAt(w, 0, 0, 0.6)).toBeNull();
});
