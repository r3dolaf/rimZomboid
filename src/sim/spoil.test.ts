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
  const inv = { ...emptyInventory(), veg: 20, meal: 10, food: 7 };
  rot(inv, rng);
  expect(inv.veg).toBe(18); // 10 %
  expect(inv.meal).toBe(7); // 30 %
  expect(inv.food).toBe(7); // las latas no se estropean
  // Con 1 hortaliza, se pierde una de cada diez veces (más o menos).
  let lost = 0;
  for (let i = 0; i < 1000; i++) {
    const one = { ...emptyInventory(), veg: 1 };
    rot(one, rng);
    lost += 1 - one.veg;
  }
  expect(lost).toBeGreaterThan(60);
  expect(lost).toBeLessThan(140);
});

test('se estropea a las 06:00, en todo el mapa (almacén, montones, encima, bolsas) y se avisa', () => {
  const w = emptyWorld(4, 4);
  const s = w.survivors[0]!;
  w.storage.items = { ...emptyInventory(), veg: 10, meal: 10 };
  w.piles.push({ id: 50, pos: { x: 2, y: 2 }, items: { ...emptyInventory(), veg: 10 } });
  s.carrying.meal = 10;
  const bag = newBag(w.common, 'schoolBag');
  bag.items.veg = 10;
  s.bags.back = bag;
  w.tick = DAWN - 1;
  spoilSystem(w);
  expect(w.storage.items.veg).toBe(10); // aún no
  w.tick = DAWN;
  spoilSystem(w);
  expect(w.storage.items).toMatchObject({ veg: 9, meal: 7 });
  expect(w.piles[0]!.items.veg).toBe(9);
  expect(s.carrying.meal).toBe(7);
  expect(bag.items.veg).toBe(9);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'spoiled', veg: 1, meal: 3 });
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
  expect(es.log.spoiled(3, 1)).toBe('Se han estropeado 3 hortalizas y 1 guiso en el almacén');
  expect(es.log.spoiled(0, 1)).toBe('Se ha estropeado 1 guiso en el almacén');
});
