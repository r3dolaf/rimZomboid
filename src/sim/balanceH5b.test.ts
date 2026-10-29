// H5b §10, ajuste tras la partida larga (el usuario pidió que la buena ropa se note): la ropa buena
// protege más y sale más a menudo en el botín; la del principio, como en la spec.
import { expect, test } from 'vitest';
import { GARMENTS, LOOT_GARMENTS, START_EXTRAS } from './balance';

test('cifras del ajuste: la ropa buena protege más', () => {
  const p = (k: keyof typeof GARMENTS) => [GARMENTS[k].scratch, GARMENTS[k].bite];
  expect(p('denimJacket')).toEqual([0.6, 0.35]);
  expect(p('leatherJacket')).toEqual([0.75, 0.5]);
  expect(p('coat')).toEqual([0.55, 0.3]);
  expect(p('vest')).toEqual([0.85, 0.65]);
  expect(p('workPants')).toEqual([0.5, 0.3]);
  expect(p('chaps')).toEqual([0.7, 0.5]);
  expect(p('helmet')).toEqual([0.8, 0.65]);
  // La del principio, como en la spec.
  expect(p('tshirt')).toEqual([0.1, 0]);
  expect(p('jeans')).toEqual([0.35, 0.15]);
  expect(p('tracksuit')).toEqual([0.15, 0.05]);
  expect(START_EXTRAS).toEqual(['hoodie', 'shirt', 'cap']);
});

test('cifras del ajuste: más ropa buena en el botín', () => {
  expect(LOOT_GARMENTS.house!.count).toEqual([1, 3]);
  expect(LOOT_GARMENTS.house!.kinds).toMatchObject({ denimJacket: 3, coat: 2 });
  expect(LOOT_GARMENTS.clothes!.kinds).toMatchObject({ denimJacket: 4, leatherJacket: 3, coat: 2 });
  expect(LOOT_GARMENTS.police!.count).toEqual([4, 6]);
  for (const k of ['hardware', 'farm', 'warehouse'] as const)
    expect(LOOT_GARMENTS[k]!.count).toEqual([2, 4]);
});
