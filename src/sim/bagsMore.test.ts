// H5b2 §6: zombis y desconocidos con bolsa; coser la bolsa de tela.
import { expect, test } from 'vitest';
import { RECIPES, STRANGER_BAG_CHANCE, TICKS_PER_HOUR, ZOMBIE_BAG } from './balance';
import { bagsIn, isBag, wornBags } from './bags';
import { leaveCorpse } from './corpses';
import { checkInvariants } from './invariants';
import { billWanted, finishCraft } from './jobs/craft';
import { weightOf } from './items';
import { newStranger } from './systems/strangers';
import { emptyWorld } from './testing/fixtures';
import type { Bill } from './types';
import { createRng } from './rng';
import { newZombie } from './zombies/spawn';

test('cifras: 1 de cada 10 zombis con bolsa (1 a 3 cosas); 3 de cada 10 desconocidos', () => {
  expect(ZOMBIE_BAG).toEqual({
    chance: 0.1,
    kinds: { fannyPack: 2, schoolBag: 2, duffel: 1 },
    items: [1, 3],
    from: ['food', 'bandage', 'cloth', 'waterBottle', 'painkillers'],
  });
  expect(STRANGER_BAG_CHANCE).toBe(0.3);
});

test('algunos zombis llevan una bolsa con cosas; queda en su cuerpo', () => {
  const w = emptyWorld(30, 30);
  const zs = Array.from({ length: 400 }, () => newZombie(w, { x: 5, y: 5 }));
  const withBag = zs.filter((z) => z.bags.length > 0);
  expect(withBag.length / zs.length).toBeGreaterThan(0.05);
  expect(withBag.length / zs.length).toBeLessThan(0.16);
  for (const z of withBag) {
    expect(z.bags).toHaveLength(1);
    const b = z.bags[0]!;
    expect(['fannyPack', 'schoolBag', 'duffel']).toContain(b.kind);
    const n = ZOMBIE_BAG.from.reduce((acc, k) => acc + b.items[k], 0);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(3);
  }
  // Uno que fue persona no se viste ni lleva bolsa de serie.
  expect(newZombie(w, { x: 5, y: 5 }, false).bags).toEqual([]);
  const z = withBag[0]!;
  const bag = z.bags[0]!;
  w.zombies.push(z);
  w.zombies = w.zombies.filter((x) => x !== z);
  leaveCorpse(w, z);
  expect(w.containers.at(-1)!.items.pieces).toContain(bag);
});

test('algunos desconocidos llegan con riñonera o mochila escolar', () => {
  let bags = 0;
  const n = 300;
  for (let seed = 1; seed <= n; seed++) {
    const w = emptyWorld(10, 10);
    w.rng = createRng(seed);
    const s = newStranger(w, { x: 2, y: 2 });
    for (const b of wornBags(s)) {
      expect(['fannyPack', 'schoolBag']).toContain(b.kind);
      bags++;
    }
  }
  expect(bags / n).toBeGreaterThan(0.2);
  expect(bags / n).toBeLessThan(0.4);
});

test('coser una bolsa de tela: 4 de tela y 2 de hilo, con aguja, 1 hora; sale la bolsa', () => {
  expect(RECIPES.sewBag).toMatchObject({
    input: { cloth: 4, thread: 2 },
    tool: 'needle',
    ticks: TICKS_PER_HOUR,
    makes: 'clothBag',
  });
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.skills.craft.level = 10;
  w.rng = createRng(1);
  s.carrying.cloth = 4;
  s.carrying.thread = 2;
  const bill: Bill = { id: 1, recipe: 'sewBag', mode: 'until', target: 1, done: 0 };
  w.bills = [bill];
  expect(billWanted(w, bill)).toBe(true);
  finishCraft(w, s, { billId: 1, recipe: 'sewBag' });
  const made = bagsIn(s.carrying.pieces);
  expect(made.map((b) => b.kind)).toEqual(['clothBag']);
  expect(weightOf(s.carrying)).toBeCloseTo(0.3, 9);
  // «Hasta tener 1»: cuenta las bolsas de tela del almacén.
  w.storage.items.pieces.push(...made);
  s.carrying.pieces = [];
  expect(billWanted(w, bill)).toBe(false);
  expect(w.storage.items.pieces.filter(isBag)).toHaveLength(1);
  expect(checkInvariants(w)).toEqual([]);
});
