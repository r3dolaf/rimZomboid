// H5b §4: atuendos — de serie, crear, renombrar, borrar, prendas permitidas y de muertos.
import { expect, test } from 'vitest';
import { GARMENT_KINDS } from './clothes';
import { checkInvariants } from './invariants';
import { issue, ordersSystem } from './orders';
import { effectiveOutfits } from './outfits';
import { acceptStrangers, newStranger } from './systems/strangers';
import { createWorld } from './world';

test('de serie: Cualquiera (todo y de muertos), Saqueo y Base; todos empiezan con Cualquiera', () => {
  const w = createWorld(1);
  expect(w.outfits.map((o) => o.name)).toEqual(['Cualquiera', 'Saqueo', 'Base']);
  const [any, loot, home] = w.outfits;
  expect(any!.allowed).toEqual(GARMENT_KINDS);
  expect(any!.dead).toBe(true);
  expect(loot!.allowed).toEqual(
    expect.arrayContaining(['denimJacket', 'leatherJacket', 'vest', 'jeans', 'workPants', 'chaps']),
  );
  expect(loot!.allowed).toEqual(
    expect.arrayContaining(['helmet', 'beanie', 'tshirt', 'longSleeve']),
  );
  expect(loot!.allowed).not.toContain('cap');
  expect(home!.allowed).not.toEqual(expect.arrayContaining(['helmet']));
  for (const k of ['helmet', 'vest', 'chaps'] as const) expect(home!.allowed).not.toContain(k);
  expect(home!.allowed.length).toBe(GARMENT_KINDS.length - 3);
  for (const s of w.survivors) expect(s.outfitId).toBe(any!.id);
  expect(checkInvariants(w)).toEqual([]);
});

test('crear, renombrar y borrar (siempre queda uno; sus colonos pasan al primero)', () => {
  const w = createWorld(1);
  issue(w, { type: 'addOutfit' });
  ordersSystem(w);
  const mine = w.outfits.at(-1)!;
  expect(w.outfits).toHaveLength(4);
  expect(mine.allowed).toEqual(GARMENT_KINDS);
  expect(mine.dead).toBe(false);
  issue(w, { type: 'renameOutfit', outfitId: mine.id, name: '  Noche  ' });
  issue(w, { type: 'setOutfit', survivorId: w.survivors[0]!.id, outfitId: mine.id });
  ordersSystem(w);
  expect(mine.name).toBe('Noche');
  expect(w.survivors[0]!.outfitId).toBe(mine.id);
  issue(w, { type: 'renameOutfit', outfitId: mine.id, name: '   ' }); // vacío: no
  ordersSystem(w);
  expect(mine.name).toBe('Noche');
  issue(w, { type: 'deleteOutfit', outfitId: mine.id });
  ordersSystem(w);
  expect(w.outfits).toHaveLength(3);
  expect(w.survivors[0]!.outfitId).toBe(w.outfits[0]!.id);
  for (const o of [...w.outfits]) issue(w, { type: 'deleteOutfit', outfitId: o.id });
  ordersSystem(w);
  expect(w.outfits).toHaveLength(1);
  expect(checkInvariants(w)).toEqual([]);
});

test('casillas por prenda y "Acepta ropa de muertos"', () => {
  const w = createWorld(1);
  const base = w.outfits[2]!;
  issue(w, { type: 'setOutfitGarment', outfitId: base.id, garment: 'helmet', on: true });
  issue(w, { type: 'setOutfitGarment', outfitId: base.id, garment: 'cap', on: false });
  issue(w, { type: 'setOutfitDead', outfitId: base.id, on: true });
  ordersSystem(w);
  expect(base.allowed).toContain('helmet');
  expect(base.allowed).not.toContain('cap');
  expect(base.dead).toBe(true);
  // En el orden del catálogo, sin repetir.
  issue(w, { type: 'setOutfitGarment', outfitId: base.id, garment: 'helmet', on: true });
  ordersSystem(w);
  expect(base.allowed.filter((k) => k === 'helmet')).toHaveLength(1);
  expect(base.allowed).toEqual(GARMENT_KINDS.filter((k) => base.allowed.includes(k)));
});

test('en pausa, la interfaz ve los atuendos con las órdenes pendientes', () => {
  const w = createWorld(1);
  issue(w, { type: 'addOutfit' });
  issue(w, { type: 'setOutfitDead', outfitId: 1, on: false });
  const view = effectiveOutfits(w);
  expect(view).toHaveLength(4);
  expect(view[0]!.dead).toBe(false);
  expect(w.outfits).toHaveLength(3); // el mundo no cambia
  expect(w.outfits[0]!.dead).toBe(true);
});

test('quien se une a la colonia lleva el primer atuendo', () => {
  const w = createWorld(2);
  const s = newStranger(w, { x: 1, y: 1 });
  s.outfitId = 999;
  w.stranger = { survivors: [s], leaving: false };
  acceptStrangers(w);
  expect(s.outfitId).toBe(w.outfits[0]!.id);
  expect(checkInvariants(w)).toEqual([]);
  s.outfitId = 999;
  expect(checkInvariants(w).some((p) => p.includes('atuendo'))).toBe(true);
});
