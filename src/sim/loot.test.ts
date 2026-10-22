import { expect, test } from 'vitest';
import { LOOT_BANDAGE_TOTAL, LOOT_FOOD_TOTAL } from './balance';
import { emptyInventory } from './items';
import { distributeLoot } from './loot';
import { createRng } from './rng';
import type { World } from './types';
import { createWorld } from './world';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const dist = (w: World, houseId: number) => {
  const h = w.houses.find((x) => x.id === houseId)!;
  return Math.hypot(h.door.x - w.base.door.x, h.door.y - w.base.door.y);
};

test.each(SEEDS)('semilla %i: 80 latas y 15 vendas repartidas por las casas', (seed) => {
  const w = createWorld(seed);
  const sum = (k: 'food' | 'bandage') => w.containers.reduce((n, c) => n + c.items[k], 0);
  expect(sum('food')).toBe(LOOT_FOOD_TOTAL);
  expect(sum('bandage')).toBe(LOOT_BANDAGE_TOTAL);
});

test('las casas lejanas tienen más comida que las cercanas', () => {
  let far = 0;
  let near = 0;
  for (const seed of SEEDS) {
    const w = createWorld(seed);
    const byDist = [...w.houses].sort((a, b) => dist(w, a.id) - dist(w, b.id));
    const food = (id: number) =>
      w.containers.filter((c) => c.houseId === id).reduce((n, c) => n + c.items.food, 0);
    near += food(byDist[0]!.id);
    far += food(byDist.at(-1)!.id);
  }
  expect(far).toBeGreaterThan(near * 1.5);
});

test('los contenedores empiezan sin registrar, sin marcar y sin reserva', () => {
  for (const c of createWorld(3).containers) {
    expect(c.searched).toBe(false);
    expect(c.designated).toBe(false);
    expect(c.reservedBy).toBeNull();
    expect(c.kind).not.toBe('corpse');
  }
});

test('determinista: misma semilla, mismos contenedores', () => {
  expect(createWorld(9).containers).toEqual(createWorld(9).containers);
});

test('si una casa no tuviera contenedores, su botín va a las demás (no se pierde)', () => {
  const w = createWorld(4);
  const [h1, h2] = w.houses;
  const containers = w.containers.filter((c) => c.houseId === h2!.id);
  for (const c of containers) c.items = emptyInventory();
  const rng = createRng(1);
  distributeLoot(w.base, [h1!, h2!], containers.length ? containers : [], rng);
  const sum = containers.reduce((n, c) => n + c.items.food, 0);
  expect(sum).toBe(LOOT_FOOD_TOTAL); // h1 no tiene contenedores en la lista: todo va a h2
});
