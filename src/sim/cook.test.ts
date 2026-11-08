// V1 §5: cocinar en la hoguera.
import { expect, test } from 'vitest';
import { RECIPES, TICKS_PER_HOUR } from './balance';
import { checkInvariants } from './invariants';
import { craftBlocker } from './jobs/craft';
import { issue, ordersSystem } from './orders';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import { Tile, type World } from './types';

/** Suelo de la base, el almacén en (1, 1) con 5 hortalizas y Ana (solo Fabricar) junto a él. */
function kitchen(): World {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.veg = 5;
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 2.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = k === 'craft';
  s.skills.craft.level = 10; // no falla
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  return w;
}

test('Cocinar: 2 hortalizas, un guiso, media hora en la hoguera', () => {
  expect(RECIPES.cook).toEqual({
    input: { veg: 2 },
    tool: null,
    output: { meal: 1 },
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
  for (let i = 0; i < 3 * TICKS_PER_HOUR && w.storage.items.meal < 2; i++) step(w);
  expect(w.storage.items.meal).toBe(2);
  expect(w.storage.items.veg).toBe(1);
  expect(checkInvariants(w)).toEqual([]);
});
