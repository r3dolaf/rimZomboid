// Escenarios de relaciones (H3b) en partidas reales.
import { expect, test } from 'vitest';
import { withoutZombies } from './testing/fixtures';
import { TICKS_PER_DAY } from './balance';
import { relationLabel } from './social';
import { step } from './step';
import { createWorld } from './world';

test('colonos que charlan durante días acaban siendo amigos', () => {
  const w = withoutZombies(createWorld(11));
  w.storage.items.food = 200; // H5: sin comida se desmayan de hambre, y aquí se prueba charlar
  const [a, b] = w.survivors;
  expect(relationLabel(a!, b!.id)).toBeNull();
  for (let i = 0; i < 10 * TICKS_PER_DAY; i++) step(w);
  const friends = w.survivors.flatMap((s) =>
    w.survivors.filter((o) => o !== s && relationLabel(s, o.id) === 'friend'),
  );
  expect(friends.length).toBeGreaterThan(0);
});
