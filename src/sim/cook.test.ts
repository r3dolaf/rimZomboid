// V1 §5: cocinar en la hoguera.
import { expect, test } from 'vitest';
import { RECIPES, TICKS_PER_HOUR } from './balance';
import { checkInvariants } from './invariants';
import { craftBlocker } from './jobs/craft';
import { issue, ordersSystem } from './orders';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import type { ItemKind } from './items';
import { Tile, type RecipeId, type World } from './types';

/** Suelo de la base, el almacén en (1, 1) con 5 hortalizas y Ana (solo Fabricar) junto a él. */
function kitchen(): World {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.potato = 5;
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 2.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'craft';
  s.skills.craft.level = 10; // no falla
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100, thirst: 100 };
  s.nextChatAt = 1e9;
  return w;
}

test('Cocinar (guiso de verduras): 2 hortalizas cualesquiera, un guiso, media hora en la hoguera', () => {
  expect(RECIPES.cook).toEqual({
    input: {},
    anyVeg: 2,
    tool: null,
    output: { stewVeg: 1 },
    ticks: 0.5 * TICKS_PER_HOUR,
    station: 'campfire',
  });
});

test('sin hoguera no se puede; con ella, cocina los guisos pedidos y los lleva al almacén', () => {
  const w = kitchen();
  expect(craftBlocker(w, RECIPES.cook)).toEqual({ kind: 'station', station: 'campfire' });
  w.furniture.push({ id: 80, kind: 'campfire', pos: { x: 6, y: 6 } });
  expect(craftBlocker(w, RECIPES.cook)).toBeNull();
  issue(w, { type: 'addBill', recipe: 'cook' });
  ordersSystem(w);
  issue(w, { type: 'setBill', billId: w.bills[0]!.id, mode: 'count', target: 2 });
  for (let i = 0; i < 3 * TICKS_PER_HOUR && w.storage.items.stewVeg < 2; i++) step(w);
  expect(w.storage.items.stewVeg).toBe(2);
  expect(w.storage.items.potato).toBe(1);
  expect(checkInvariants(w)).toEqual([]);
});

/** Con hoguera y mesa, pide una vez la receta y deja trabajar; devuelve el mundo. */
function cookOnce(recipe: RecipeId, items: Partial<Record<ItemKind, number>>): World {
  const w = kitchen();
  w.storage.items.potato = 0;
  Object.assign(w.storage.items, items);
  w.furniture.push({ id: 80, kind: 'campfire', pos: { x: 6, y: 6 } });
  w.furniture.push({ id: 81, kind: 'table', pos: { x: 8, y: 3 } });
  issue(w, { type: 'addBill', recipe });
  ordersSystem(w);
  issue(w, { type: 'setBill', billId: w.bills[0]!.id, mode: 'count', target: 1 });
  const out = Object.keys(RECIPES[recipe].output)[0] as ItemKind;
  for (let i = 0; i < 3 * TICKS_PER_HOUR && w.storage.items[out] < 1; i++) step(w);
  expect(w.storage.items[out], recipe).toBe(1);
  expect(checkInvariants(w)).toEqual([]);
  return w;
}

test('V4: las cinco recetas dan su plato (la ensalada, en la mesa)', () => {
  expect(RECIPES.salad.station).toBe('table');
  for (const r of ['cookPotato', 'soup', 'preserve'] as const)
    expect(RECIPES[r].station).toBe('campfire');
  cookOnce('cook', { tomato: 2 });
  cookOnce('cookPotato', { potato: 2, lettuce: 1 });
  cookOnce('soup', { cabbage: 1, waterBottle: 1 });
  cookOnce('salad', { lettuce: 1, tomato: 1 });
  cookOnce('preserve', { tomato: 3 });
});

test('V4: el guiso de verduras gasta dos hortalizas cualesquiera (primero lo que antes se estropea)', () => {
  const w = cookOnce('cook', { lettuce: 1, cabbage: 1, potato: 1 });
  expect(w.storage.items.lettuce + w.storage.items.cabbage).toBe(0);
  expect(w.storage.items.potato).toBe(1);
});

test('V4: el guiso de patatas con 3 patatas gasta las 3; con 2 justas y nada más, falta una hortaliza', () => {
  const w = cookOnce('cookPotato', { potato: 3 });
  expect(w.storage.items.potato).toBe(0);
  const k = kitchen();
  k.storage.items.potato = 2;
  k.furniture.push({ id: 80, kind: 'campfire', pos: { x: 6, y: 6 } });
  expect(craftBlocker(k, RECIPES.cookPotato)).toEqual({ kind: 'anyVeg', missing: 1 });
  k.storage.items.tomato = 1;
  expect(craftBlocker(k, RECIPES.cookPotato)).toBeNull();
});

test('V4: la sopa gasta una botella de agua; sin botellas, el agua de un cubo (vuelve vacío); sin agua, no', () => {
  const w = cookOnce('soup', { cabbage: 1, waterBottle: 1 });
  expect(w.storage.items.waterBottle).toBe(0);
  const b = cookOnce('soup', { cabbage: 1, waterBucket: 1 });
  expect(b.storage.items.waterBucket).toBe(0);
  expect(b.storage.items.bucket).toBe(1);
  const k = kitchen();
  k.storage.items.cabbage = 1;
  k.furniture.push({ id: 80, kind: 'campfire', pos: { x: 6, y: 6 } });
  expect(craftBlocker(k, RECIPES.soup)).toEqual({ kind: 'liquid' });
});
