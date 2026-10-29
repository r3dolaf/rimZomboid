// H5b2 §1: las bolsas son piezas, con lo de dentro y su lista; se cuentan con todo lo que llevan.
import { expect, test } from 'vitest';
import { BAGS, ITEM_WEIGHT_KG, KEEP_DEFAULT } from './balance';
import { BAG_SLOTS, bagRoom, garments, isBag, newBag, wornBags } from './bags';
import { allPieces, newGarment, piecesGone } from './clothes';
import { checkInvariants } from './invariants';
import { pieceKg, weightOf } from './items';
import { emptyWorld } from './testing/fixtures';

test('catálogo: hueco, capacidad, lo que pesa lo de dentro y la bolsa vacía (spec §1)', () => {
  expect(BAGS).toEqual({
    fannyPack: { slots: ['waist'], capacity: 2, factor: 0.8, kg: 0.2 },
    clothBag: { slots: ['back', 'hand'], capacity: 4, factor: 0.8, kg: 0.3 },
    schoolBag: { slots: ['back'], capacity: 6, factor: 0.7, kg: 0.5 },
    duffel: { slots: ['back', 'hand'], capacity: 8, factor: 0.7, kg: 1 },
    hikingPack: { slots: ['back'], capacity: 12, factor: 0.6, kg: 1.5 },
  });
  expect(BAG_SLOTS).toEqual(['waist', 'back', 'hand']);
  expect(KEEP_DEFAULT).toEqual({ bandage: 2 });
});

test('una bolsa nueva es una pieza vacía y sin lista; fuera de la espalda pesa vacía + lo de dentro', () => {
  const w = emptyWorld(5, 5);
  const made = w.pieceLog.made;
  const b = newBag(w, 'schoolBag');
  expect(b).toMatchObject({ kind: 'schoolBag', list: {} });
  expect(w.pieceLog.made).toBe(made + 1);
  expect(isBag(b)).toBe(true);
  const cap = newGarment(w, 'cap');
  expect(isBag(cap)).toBe(false);
  expect(pieceKg(b)).toBeCloseTo(0.5, 9);
  b.items.food = 2;
  b.items.pieces.push(cap);
  expect(pieceKg(b)).toBeCloseTo(0.5 + 2 * ITEM_WEIGHT_KG.food + 0.1, 9);
  expect(bagRoom(b)).toBeCloseTo(6 - weightOf(b.items), 9);
  expect(garments([b, cap])).toEqual([cap]);
});

test('lo puesto y lo de dentro son piezas; al irse del mapa, se cuenta también lo de dentro', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  expect(s.bags).toEqual({ waist: null, back: null, hand: null });
  expect(s.keep).toEqual({ bandage: 2 });
  expect(s.bagsPinned).toEqual([]);
  expect(s.droppedBag).toBeNull();
  expect(w.bagLog).toEqual({ found: 0, dropped: 0, recovered: 0 });
  const b = newBag(w, 'hikingPack');
  const cap = newGarment(w, 'cap');
  b.items.pieces.push(cap);
  s.bags.back = b;
  const fanny = newBag(w, 'fannyPack');
  s.bags.waist = fanny;
  expect(wornBags(s)).toEqual([fanny, b]);
  expect(allPieces(w).map((x) => x.piece)).toEqual(expect.arrayContaining([b, cap, fanny]));
  expect(checkInvariants(w)).toEqual([]);
  s.bags.back = null;
  piecesGone(w, [b]);
  expect(checkInvariants(w)).toEqual([]);
});

test('invariantes: bolsa dentro de bolsa, hueco que no le vale, pasarse, listas no válidas', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  const b = newBag(w, 'fannyPack');
  s.bags.back = b; // la riñonera va en la cintura
  expect(checkInvariants(w).join('\n')).toMatch(/riñonera|fannyPack/);
  s.bags.back = null;
  s.bags.waist = b;
  b.items.food = 5; // 2,5 kg en una de 2
  expect(checkInvariants(w).join('\n')).toMatch(/capacidad/);
  b.items.food = 1;
  b.items.pieces.push(newBag(w, 'clothBag'));
  expect(checkInvariants(w).join('\n')).toMatch(/dentro de otra/);
  b.items.pieces = [];
  w.pieceLog.gone++; // (la de tela ya no está)
  b.list = { bandage: -1 };
  expect(checkInvariants(w).join('\n')).toMatch(/lista/);
  b.list = { bandage: 2 };
  s.keep = { food: 1.5 };
  expect(checkInvariants(w).join('\n')).toMatch(/Llevar siempre/);
  s.keep = { food: 1 };
  expect(checkInvariants(w)).toEqual([]);
});

test('los zombis y los que vuelven pueden llevar bolsas (se cuentan)', () => {
  const w = emptyWorld(5, 5);
  const b = newBag(w, 'duffel');
  b.items.pieces.push(newGarment(w, 'beanie'));
  w.returning.push({
    kind: 'zombie',
    at: 1e9,
    pos: { x: 0, y: 0 },
    name: 'Ana',
    survivorId: 99,
    worn: [],
    bags: [b],
  });
  expect(allPieces(w).map((x) => x.piece)).toContain(b);
  expect(checkInvariants(w)).toEqual([]);
});

test('partida larga: la madera dentro de una bolsa cuenta, y si la bolsa se va del mundo, se pierde', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  w.storage.items.wood = 3;
  w.woodLog.start += 3;
  expect(checkInvariants(w)).toEqual([]);
  const b = newBag(w, 'schoolBag');
  w.storage.items.wood -= 2;
  b.items.wood = 2;
  s.bags.back = b;
  expect(checkInvariants(w)).toEqual([]); // la de la bolsa sigue estando
  s.bags.back = null;
  piecesGone(w, [b]); // p. ej., se pudre en el cuerpo de un zombi
  expect(checkInvariants(w)).toEqual([]);
});

test('las armas que se van del mundo dentro de una bolsa se apuntan (como las que se pudren)', () => {
  const w = emptyWorld(5, 5);
  const b = newBag(w, 'duffel');
  b.items.machete = 1;
  b.items.knife = 2;
  const before = w.weaponLog.rotted;
  piecesGone(w, [b]);
  expect(w.weaponLog.rotted).toBe(before + 3);
});
