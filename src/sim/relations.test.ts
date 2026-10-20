// Escenarios de relaciones (H3b) en partidas reales.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from './balance';
import { relationLabel } from './social';
import { step } from './step';
import { createWorld } from './world';

test('colonos que charlan durante días acaban siendo amigos', () => {
  const w = createWorld(11);
  const [a, b] = w.survivors;
  expect(relationLabel(a!, b!.id)).toBeNull();
  for (let i = 0; i < 10 * TICKS_PER_DAY; i++) step(w);
  const friends = w.survivors.flatMap((s) =>
    w.survivors.filter((o) => o !== s && relationLabel(s, o.id) === 'friend'),
  );
  expect(friends.length).toBeGreaterThan(0);
});
