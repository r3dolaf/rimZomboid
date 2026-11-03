// H5c3 §2: en tormenta nadie avanza (esperan a cubierto); y las comprobaciones del camino.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../balance';
import { dayStart } from '../clock';
import { hexToward } from '../expeditions';
import { stepGame } from '../game';
import { checkInvariants } from '../invariants';
import { emptyWorld, travelFor } from '../testing/fixtures';
import { roadEvent } from './events';

function onTheRoad() {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  w.narrator.nextEventAt = 1e9;
  const ana = w.survivors[0]!;
  w.survivors = [];
  const to = hexToward(atlas, atlas.base, 3, 8);
  const t = travelFor(w, { kind: 'go', from: atlas.base, to, members: [ana], hoursLeft: 1 });
  t.at = 1;
  t.nextEventAt = 1e9;
  w.common.expedition.travels.push(t);
  w.tick = dayStart(1) + 9 * TICKS_PER_HOUR;
  return { w, t };
}

test('en tormenta los grupos no avanzan; al pasar, siguen', () => {
  const { w, t } = onTheRoad();
  w.common.stormUntil = w.tick + 2 * TICKS_PER_HOUR;
  const [at, left] = [t.at, t.hoursLeft];
  for (let i = 0; i < TICKS_PER_HOUR; i++) stepGame(w);
  expect([t.at, t.hoursLeft]).toEqual([at, left]);
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) stepGame(w);
  expect(t.at).toBeGreaterThan(at);
});

test('las comprobaciones: quien pide unirse tiene su decisión, y las decisiones del camino, su viaje', () => {
  const { w, t } = onTheRoad();
  roadEvent(w, t, t.path[t.at]!, 'joiner');
  expect(checkInvariants(w)).toEqual([]);
  const d = w.decisions[0]!;
  w.decisions = [];
  expect(checkInvariants(w).some((p) => p.includes('pide unirse sin decisión'))).toBe(true);
  w.decisions = [{ ...d, travelId: 12345 }];
  expect(checkInvariants(w).some((p) => p.includes('de un viaje que no está'))).toBe(true);
});
