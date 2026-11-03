// H5c3 §3: la comida del viaje: cuánta hace falta, compartirla en el grupo y la de explorar.
import { expect, test } from 'vitest';
import { EAT_BELOW, EXPLORE_DIST, HEX_HOURS, TICKS_PER_HOUR, TRIP_FOOD_MARGIN } from '../balance';
import { dayStart } from '../clock';
import { hexToward } from '../expeditions';
import { stepGame } from '../game';
import { issue, ordersSystem } from '../orders';
import { addSurvivor, emptyWorld, travelFor } from '../testing/fixtures';
import { tripFood } from './food';

test('las latas por persona: un día de luz son 14 h; de noche no se anda pero se come; y una de margen', () => {
  expect(TRIP_FOOD_MARGIN).toBe(1);
  expect(tripFood(10, false)).toBe(2 + 1); // 1 día: 70 de hambre son 2 latas de 60
  expect(tripFood(10, true)).toBe(3 + 1); // ida y vuelta: 2 días
  expect(tripFood(20, false)).toBe(3 + 1); // 2 días
  expect(tripFood(0, false)).toBe(1); // sin camino, solo el margen
});

test('quien tiene hambre y no lleva comida come de lo del compañero que más tiene', () => {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 1, y: 1 }, 'Bea');
  const cris = addSurvivor(w, { x: 1, y: 1 }, 'Cris');
  w.survivors = [];
  for (const s of [ana, bea, cris]) {
    s.carrying.food = 0;
    s.needs.hunger = 90;
  }
  bea.carrying.food = 1;
  cris.carrying.food = 3;
  ana.needs.hunger = EAT_BELOW - 1;
  w.common.expedition.travels.push(
    travelFor(w, {
      kind: 'go',
      from: atlas.base,
      to: hexToward(atlas, atlas.base, 3, 4),
      members: [ana, bea, cris],
      hoursLeft: 3,
    }),
  );
  w.tick = dayStart(1) + 10 * TICKS_PER_HOUR;
  stepGame(w);
  expect(ana.needs.hunger).toBeGreaterThan(EAT_BELOW);
  expect([bea.carrying.food, cris.carrying.food]).toEqual([1, 2]);
});

test('quien sale a explorar se lleva la comida de ida y vuelta (como mínimo una lata)', () => {
  const w = emptyWorld(20, 20);
  w.storage.tiles = [{ x: 5, y: 5 }];
  w.storage.items.food = 20;
  const ana = w.survivors[0]!;
  const { atlas } = w.common;
  const target = hexToward(atlas, atlas.base, 0, EXPLORE_DIST);
  issue(w, { type: 'explore', target, survivorIds: [ana.id] });
  ordersSystem(w);
  expect(ana.trip?.items.food).toBe(tripFood(EXPLORE_DIST * HEX_HOURS.field, true));
});
