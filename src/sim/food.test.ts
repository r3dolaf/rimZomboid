import { expect, test } from 'vitest';
import { EAT_RESTORE, MEAL_RESTORE, VEG_RESTORE } from './balance';
import { brains } from './brain';
import { bestFood, eatFrom, eatFromPack, foodUnits, hasFood, packFood } from './food';
import { emptyInventory } from './items';
import { activitiesSystem } from './systems/activities';
import { emptyWorld } from './testing/fixtures';

test('se come primero el guiso, luego las hortalizas y al final las latas', () => {
  const inv = { ...emptyInventory(), food: 2, veg: 1, meal: 1 };
  expect(bestFood(inv)).toBe('meal');
  expect(eatFrom(inv)).toEqual({ kind: 'meal', restore: MEAL_RESTORE });
  expect(eatFrom(inv)).toEqual({ kind: 'veg', restore: VEG_RESTORE });
  expect(eatFrom(inv)).toEqual({ kind: 'food', restore: EAT_RESTORE });
  expect(inv.food).toBe(1);
  expect(inv.meal + inv.veg).toBe(0);
});

test('sin comida no se come nada', () => {
  const inv = emptyInventory();
  expect(hasFood(inv)).toBe(false);
  expect(bestFood(inv)).toBeNull();
  expect(eatFrom(inv)).toBeNull();
});

test('la comida se cuenta en latas por lo que quita de hambre', () => {
  const inv = { ...emptyInventory(), food: 3, meal: 3, veg: 12 };
  expect(foodUnits(inv)).toBeCloseTo(3 + (3 * 80) / 60 + (12 * 35) / 60, 9);
});

test('de lo suyo: también de sus bolsas y en el mismo orden', () => {
  const s = emptyWorld(3, 3).survivors[0]!;
  s.carrying.food = 1;
  s.carrying.veg = 1;
  expect(packFood(s)).toBe('veg');
  expect(eatFromPack(s)?.kind).toBe('veg');
  expect(eatFromPack(s)?.kind).toBe('food');
  expect(eatFromPack(s)).toBeNull();
});

test('comer un guiso del almacén quita 80 y es comida caliente; si se acaba, se avisa', () => {
  const w = emptyWorld(3, 3);
  const s = w.survivors[0]!;
  w.storage.items = { ...emptyInventory(), meal: 1 };
  s.needs.hunger = 10;
  s.action = { type: 'eat', ticksLeft: 1 };
  activitiesSystem(w);
  expect(s.needs.hunger).toBe(90);
  expect(s.memories.map((m) => m.id)).toContain('hotMeal');
  expect(s.memories.map((m) => m.id)).not.toContain('ate');
  expect(w.common.log.some((e) => e.kind === 'outOfFood')).toBe(true);
});

test('con hambre y solo hortalizas en el almacén, va a comer', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  w.storage.items = { ...emptyInventory(), veg: 2 };
  s.needs.hunger = 20;
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type).toBe('eat');
});
