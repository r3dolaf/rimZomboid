// V4 §4: qué se come primero, comer variado y entrar en calor con la sopa.
import { expect, test } from 'vitest';
import { SOUP_WARM_HOURS, SOUP_WARMTH, TICKS_PER_HOUR } from './balance';
import { dayStart } from './clock';
import { ateFood, bestFood, eatFrom } from './food';
import { emptyInventory } from './items';
import { moodModifiers } from './mood';
import { feelsSystem, outdoorTemp } from './season';
import { addBase, emptyWorld } from './testing/fixtures';
import type { World } from './types';

/** Un mundo con base, a mediodía del día 3. */
function world(): World {
  const w = addBase(emptyWorld(10, 10), { x: 0, y: 0, w: 4, h: 4 });
  w.tick = dayStart(3) + 12 * TICKS_PER_HOUR;
  return w;
}

test('entre dos platos que se estropean igual, el que no comió la última vez', () => {
  const inv = { ...emptyInventory(), stewVeg: 1, stewPotato: 1 };
  expect(bestFood(inv)).toBe('stewVeg');
  expect(bestFood(inv, 'stewVeg')).toBe('stewPotato');
  expect(eatFrom(inv, 'stewVeg')?.kind).toBe('stewPotato');
  // Si solo queda ese, ese.
  expect(bestFood({ ...emptyInventory(), stewVeg: 2 }, 'stewVeg')).toBe('stewVeg');
});

test('la ensalada antes que el guiso; lo crudo antes que la conserva; la lata, al final', () => {
  expect(bestFood({ ...emptyInventory(), stewVeg: 1, salad: 1 })).toBe('salad');
  expect(bestFood({ ...emptyInventory(), preserves: 1, potato: 1 })).toBe('potato');
  expect(bestFood({ ...emptyInventory(), preserves: 1, food: 1 })).toBe('preserves');
});

test('recuerda lo último que ha comido (las 6 últimas) y la partida, cada plato comido', () => {
  const w = world();
  const s = w.survivors[0]!;
  for (const k of ['food', 'potato', 'stewVeg', 'salad', 'food', 'tomato', 'potato'] as const)
    ateFood(w, s, k);
  expect(s.ate).toEqual(['potato', 'stewVeg', 'salad', 'food', 'tomato', 'potato']);
  expect(w.common.stats.eaten).toEqual(['food', 'potato', 'stewVeg', 'salad', 'tomato']);
});

test('3 cosas distintas en las 6 últimas: «Come variado» (+4); las 6 iguales: «Siempre lo mismo» (−4)', () => {
  const w = world();
  const s = w.survivors[0]!;
  const mood = (id: string) => moodModifiers(s, w.tick).find((m) => m.id === id)?.value;
  s.ate = ['food', 'potato', 'stewVeg'];
  expect(mood('variedDiet')).toBe(4);
  expect(mood('sameFood')).toBeUndefined();
  s.ate = ['food', 'food', 'food', 'food', 'food', 'food'];
  expect(mood('sameFood')).toBe(-4);
  expect(mood('variedDiet')).toBeUndefined();
  s.ate = ['food', 'food', 'food', 'food', 'food'];
  expect(mood('sameFood')).toBeUndefined();
  expect(mood('variedDiet')).toBeUndefined();
});

test('los guisos y la sopa son comida caliente; la ensalada, algo fresco; lo demás, «ha comido»', () => {
  const w = world();
  const s = w.survivors[0]!;
  const last = () => s.memories.map((m) => m.id);
  ateFood(w, s, 'stewPotato');
  expect(last()).toContain('hotMeal');
  s.memories = [];
  ateFood(w, s, 'soupCabbage');
  expect(last()).toContain('hotMeal');
  s.memories = [];
  ateFood(w, s, 'salad');
  expect(last()).toContain('freshFood');
  expect(moodModifiers(s, w.tick).find((m) => m.id === 'freshFood')?.value).toBe(6);
  s.memories = [];
  ateFood(w, s, 'preserves');
  expect(last()).toEqual(['ate']);
});

test('la sopa hace entrar en calor: +8 grados en la sensación térmica durante 6 horas', () => {
  expect(SOUP_WARMTH).toBe(8);
  expect(SOUP_WARM_HOURS).toBe(6);
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 8.5, y: 8.5 }; // fuera
  s.worn = [];
  w.tick -= w.tick % 10; // a la hora de calcularla
  feelsSystem(w);
  const before = s.feels!;
  expect(before).toBeCloseTo(outdoorTemp(w), 5);
  ateFood(w, s, 'soupCabbage');
  feelsSystem(w);
  expect(s.feels).toBeCloseTo(before + 8, 5);
  w.tick += SOUP_WARM_HOURS * TICKS_PER_HOUR;
  feelsSystem(w);
  expect(s.feels).toBeCloseTo(outdoorTemp(w), 5);
});
