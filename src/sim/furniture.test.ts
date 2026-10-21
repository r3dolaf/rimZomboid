// H4a §4.2: mesa y hoguera.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR, VISION_DAY } from './balance';
import { furnitureSystem, visionFor } from './furniture';
import { activitiesSystem } from './systems/activities';
import { emptyWorld } from './testing/fixtures';
import { visionRadius } from './vision';

/** Ana en el centro de un prado de 30×30. */
function scene() {
  const w = emptyWorld(30, 30);
  const s = w.survivors[0]!;
  s.pos = { x: 15.5, y: 15.5 };
  return { w, s };
}

const has = (s: { memories: { id: string }[] }, id: string) => s.memories.some((m) => m.id === id);

test('quien termina de comer con una mesa a 3 casillas o menos: "Comió en la mesa"', () => {
  const near = scene();
  near.w.furniture.push({ id: 9, kind: 'table', pos: { x: 17, y: 17 } });
  near.s.action = { type: 'eat', ticksLeft: 1, fromPack: true };
  near.s.carrying.food = 1;
  activitiesSystem(near.w);
  expect(has(near.s, 'ateAtTable')).toBe(true);
  expect(has(near.s, 'ate')).toBe(true);

  const far = scene();
  far.w.furniture.push({ id: 9, kind: 'table', pos: { x: 20, y: 15 } });
  far.s.action = { type: 'eat', ticksLeft: 1, fromPack: true };
  far.s.carrying.food = 1;
  activitiesSystem(far.w);
  expect(has(far.s, 'ateAtTable')).toBe(false);
});

test('de noche, a 4 casillas o menos de una hoguera: "Junto al fuego"; de día o lejos, no', () => {
  const { w, s } = scene();
  w.furniture.push({ id: 9, kind: 'campfire', pos: { x: 17, y: 18 } }); // a 3,6 casillas
  w.tick = 14 * TICKS_PER_HOUR; // 22:00
  furnitureSystem(w);
  expect(has(s, 'byTheFire')).toBe(true);
  const day = scene();
  day.w.furniture.push({ id: 9, kind: 'campfire', pos: { x: 17, y: 18 } }); // a 3,6 casillas
  day.w.tick = 4 * TICKS_PER_HOUR; // 12:00
  furnitureSystem(day.w);
  expect(has(day.s, 'byTheFire')).toBe(false);
  const far = scene();
  far.w.furniture.push({ id: 9, kind: 'campfire', pos: { x: 21, y: 15 } });
  far.w.tick = 14 * TICKS_PER_HOUR;
  furnitureSystem(far.w);
  expect(has(far.s, 'byTheFire')).toBe(false);
});

test('de noche junto a una hoguera se ve tan lejos como de día', () => {
  const { w, s } = scene();
  w.tick = 16 * TICKS_PER_HOUR; // 00:00
  expect(visionFor(w, s)).toBe(visionRadius(w.tick));
  expect(visionRadius(w.tick)).toBeLessThan(VISION_DAY);
  w.furniture.push({ id: 9, kind: 'campfire', pos: { x: 16, y: 16 } });
  expect(visionFor(w, s)).toBe(VISION_DAY);
});
