import { expect, test } from 'vitest';
import { ITEM_WEIGHT_KG } from './balance';
import { newGarment } from './clothes';
import { addInto, addStacks, emptyInventory, isEmpty, snapshot, takeUpTo, weightOf } from './items';
import { emptyWorld } from './testing/fixtures';

const inv = (food = 0, bandage = 0, knife = 0, bat = 0) => ({
  ...emptyInventory(),
  food,
  bandage,
  knife,
  bat,
});

test('pesos: lata 0,5; venda 0,1; cuchillo 0,5; bate 1,5', () => {
  expect(weightOf(inv(2, 1, 1, 1))).toBeCloseTo(1 + 0.1 + 0.5 + 1.5, 9);
  expect(weightOf(emptyInventory())).toBe(0);
});

test('takeUpTo coge en orden comida, vendas, cuchillo y bate hasta la capacidad', () => {
  const from = inv(20, 3, 1, 1);
  const to = emptyInventory();
  const taken = takeUpTo(from, to, 8);
  expect(taken).toEqual(inv(16, 0, 0, 0));
  expect(from).toEqual(inv(4, 3, 1, 1));
  expect(to).toEqual(inv(16, 0, 0, 0));
});

test('takeUpTo tiene en cuenta lo que ya se lleva y salta lo que no cabe', () => {
  const from = inv(1, 2, 0, 1);
  const to = inv(13, 0, 0, 0); // 6,5 kg
  takeUpTo(from, to, 8);
  // cabe 1 lata (7 kg), 2 vendas (7,2 kg); el bate (1,5) ya no cabe
  expect(to).toEqual(inv(14, 2, 0, 0));
  expect(from).toEqual(inv(0, 0, 0, 1));
});

test('addInto vacía el origen en el destino', () => {
  const from = inv(3, 1, 0, 1);
  const to = inv(10, 0, 0, 0);
  addInto(to, from);
  expect(to).toEqual(inv(13, 1, 0, 1));
  expect(isEmpty(from)).toBe(true);
});

// H5b §1: piezas sueltas (prendas) además de los montones.
test('las piezas se mueven con addInto y cuentan en el peso y en si está vacío', () => {
  const w = emptyWorld(5, 5);
  const from = emptyInventory();
  const g = newGarment(w, 'denimJacket');
  from.pieces.push(g);
  expect(isEmpty(from)).toBe(false);
  expect(weightOf(from)).toBeCloseTo(1.2, 9);
  const to = emptyInventory();
  addInto(to, from);
  expect(to.pieces).toEqual([g]);
  expect(from.pieces).toEqual([]);
  expect(isEmpty(from)).toBe(true);
});

test('takeUpTo coge las piezas después de los montones, las que quepan', () => {
  const w = emptyWorld(5, 5);
  const from = { ...emptyInventory(), food: 10 }; // 5 kg
  const coat = newGarment(w, 'coat'); // 1,5 kg
  const tee = newGarment(w, 'tshirt'); // 0,2 kg
  from.pieces.push(coat, tee);
  const to = emptyInventory();
  const taken = takeUpTo(from, to, 6);
  expect(to.food).toBe(10);
  expect(to.pieces).toEqual([tee]);
  expect(from.pieces).toEqual([coat]);
  expect(taken.pieces.map((p) => p.id)).toEqual([tee.id]);
});

test('snapshot copia sin compartir piezas; addStacks suma solo los montones', () => {
  const w = emptyWorld(5, 5);
  const inv = { ...emptyInventory(), food: 2 };
  inv.pieces.push(newGarment(w, 'cap'));
  const copy = snapshot(inv);
  expect(copy).toEqual(inv);
  expect(copy.pieces[0]).not.toBe(inv.pieces[0]);
  const total = emptyInventory();
  addStacks(total, inv);
  expect(total.food).toBe(2);
  expect(total.pieces).toEqual([]);
  expect(inv.pieces).toHaveLength(1);
});

test('newGarment: id nuevo, limpia, sin agujeros y apuntada en las cuentas', () => {
  const w = emptyWorld(5, 5);
  const made = w.common.pieceLog.made;
  const a = newGarment(w, 'jeans');
  const b = newGarment(w, 'jeans');
  expect(b.id).toBe(a.id + 1);
  expect(a).toEqual({
    id: a.id,
    kind: 'jeans',
    holes: [],
    patches: {},
    pads: {},
    dirtHours: 0,
    bloody: false,
    from: null,
  });
  expect(w.common.pieceLog.made).toBe(made + 2);
  expect(w.common.nextPieceId).toBe(b.id + 1);
});

test('montones nuevos (H5b): retal de vaquero, tira de cuero, cubos y botellas, con su peso', () => {
  expect(ITEM_WEIGHT_KG).toMatchObject({
    denim: 0.2,
    leather: 0.2,
    bucket: 1,
    waterBucket: 5,
    waterBottle: 1,
  });
});
