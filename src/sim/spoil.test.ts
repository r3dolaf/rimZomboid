import { expect, test } from 'vitest';
import { es } from '../i18n/es';
import { SPOIL_HOUR, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import { emptyInventory } from './items';
import { newBag } from './bags';
import { rot, spoilSystem } from './spoil';
import { emptyWorld } from './testing/fixtures';
import { createRng } from './rng';

/** El primer tick a las 06:00 (el día 2: la partida empieza a las 08:00). */
const DAWN = TICKS_PER_DAY - (START_HOUR - SPOIL_HOUR) * TICKS_PER_HOUR;

test('cada montón pierde su parte: la entera seguro y la fracción a veces', () => {
  const rng = createRng(1);
  const inv = { ...emptyInventory(), lettuce: 20, stewVeg: 10, food: 7 };
  rot(inv, rng);
  expect(inv.lettuce).toBe(15); // 25 %
  expect(inv.stewVeg).toBe(7); // 30 %
  expect(inv.food).toBe(7); // las latas no se estropean
  // Con 1 lechuga, se pierde una de cada cuatro veces (más o menos).
  let lost = 0;
  for (let i = 0; i < 1000; i++) {
    const one = { ...emptyInventory(), lettuce: 1 };
    rot(one, rng);
    lost += 1 - one.lettuce;
  }
  expect(lost).toBeGreaterThan(200);
  expect(lost).toBeLessThan(300);
});

test('se estropea a las 06:00, en todo el mapa (almacén, montones, encima, bolsas) y se avisa', () => {
  const w = emptyWorld(4, 4);
  const s = w.survivors[0]!;
  w.storage.items = { ...emptyInventory(), lettuce: 10, stewVeg: 10 };
  w.piles.push({ id: 50, pos: { x: 2, y: 2 }, items: { ...emptyInventory(), lettuce: 10 } });
  s.carrying.stewVeg = 10;
  const bag = newBag(w.common, 'schoolBag');
  bag.items.lettuce = 10;
  s.bags.back = bag;
  w.tick = DAWN - 1;
  spoilSystem(w);
  expect(w.storage.items.lettuce).toBe(10); // aún no
  w.tick = DAWN;
  spoilSystem(w);
  expect(w.storage.items).toMatchObject({ lettuce: 8, stewVeg: 7 });
  expect(w.piles[0]!.items.lettuce).toBe(8);
  expect(s.carrying.stewVeg).toBe(7);
  expect(bag.items.lettuce).toBe(8);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'spoiled', items: { lettuce: 2, stewVeg: 3 } });
});

test('sin nada fresco no se avisa ni se tira del azar', () => {
  const w = emptyWorld(4, 4);
  const before = JSON.stringify(w.rng);
  w.tick = DAWN;
  spoilSystem(w);
  expect(w.common.log).toHaveLength(0);
  expect(JSON.stringify(w.rng)).toBe(before);
});

test('el registro dice lo que se ha estropeado', () => {
  expect(es.log.spoiled(['3 lechugas', '1 guiso de patatas'], 4)).toBe(
    'Se han estropeado 3 lechugas y 1 guiso de patatas en el almacén',
  );
  expect(es.log.spoiled(['1 guiso de verduras'], 1)).toBe(
    'Se ha estropeado 1 guiso de verduras en el almacén',
  );
});

test('V4: cada cosa se estropea a su ritmo; la conserva y la lata, nunca', () => {
  const rng = createRng(1);
  const inv = {
    ...emptyInventory(),
    lettuce: 100,
    tomato: 100,
    potato: 100,
    cabbage: 100,
    stewVeg: 100,
    salad: 100,
    preserves: 100,
    food: 100,
  };
  const lost = rot(inv, rng);
  expect(lost).toEqual({
    lettuce: 25,
    tomato: 12,
    potato: 2,
    cabbage: 5,
    stewVeg: 30,
    salad: 50,
  });
  expect(inv.preserves).toBe(100);
  expect(inv.food).toBe(100);
});
