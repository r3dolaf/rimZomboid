import { expect, test } from 'vitest';
import { EAT_RESTORE } from './balance';

const MEAL_RESTORE = 80; // el guiso de verduras
const VEG_RESTORE = 40; // la patata
import { brains } from './brain';
import {
  bestFood,
  eatFrom,
  eatFromPack,
  FOOD_RESTORE,
  FOODS,
  foodUnits,
  hasFood,
  packFood,
} from './food';
import { emptyInventory } from './items';
import { activitiesSystem } from './systems/activities';
import { emptyWorld } from './testing/fixtures';

test('se come primero el guiso, luego las hortalizas y al final las latas', () => {
  const inv = { ...emptyInventory(), food: 2, potato: 1, stewVeg: 1 };
  expect(bestFood(inv)).toBe('stewVeg');
  expect(eatFrom(inv)).toEqual({ kind: 'stewVeg', restore: MEAL_RESTORE });
  expect(eatFrom(inv)).toEqual({ kind: 'potato', restore: VEG_RESTORE });
  expect(eatFrom(inv)).toEqual({ kind: 'food', restore: EAT_RESTORE });
  expect(inv.food).toBe(1);
  expect(inv.stewVeg + inv.potato).toBe(0);
});

test('sin comida no se come nada', () => {
  const inv = emptyInventory();
  expect(hasFood(inv)).toBe(false);
  expect(bestFood(inv)).toBeNull();
  expect(eatFrom(inv)).toBeNull();
});

test('la comida se cuenta en latas por lo que quita de hambre', () => {
  const inv = { ...emptyInventory(), food: 3, stewVeg: 3, potato: 12 };
  expect(foodUnits(inv)).toBeCloseTo(3 + (3 * 80) / 60 + (12 * 40) / 60, 9);
});

test('de lo suyo: también de sus bolsas y en el mismo orden', () => {
  const s = emptyWorld(3, 3).survivors[0]!;
  s.carrying.food = 1;
  s.carrying.potato = 1;
  expect(packFood(s)).toBe('potato');
  expect(eatFromPack(s)?.kind).toBe('potato');
  expect(eatFromPack(s)?.kind).toBe('food');
  expect(eatFromPack(s)).toBeNull();
});

test('comer un guiso del almacén quita 80 y es comida caliente; si se acaba, se avisa', () => {
  const w = emptyWorld(3, 3);
  const s = w.survivors[0]!;
  w.storage.items = { ...emptyInventory(), stewVeg: 1 };
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
  w.storage.items = { ...emptyInventory(), potato: 2 };
  s.needs.hunger = 20;
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type).toBe('eat');
});

test('V4: se come primero lo que antes se estropea: platos, lo crudo, la conserva y la lata', () => {
  expect(FOODS).toEqual([
    'salad',
    'stewVeg',
    'stewPotato',
    'soupCabbage',
    'lettuce',
    'tomato',
    'cabbage',
    'potato',
    'preserves',
    'food',
  ]);
  expect(FOODS.map((k) => FOOD_RESTORE[k])).toEqual([50, 80, 100, 60, 25, 20, 35, 40, 60, 60]);
  expect(foodUnits({ ...emptyInventory(), potato: 3, salad: 1 })).toBeCloseTo(
    (3 * 40 + 50) / 60,
    9,
  );
});
