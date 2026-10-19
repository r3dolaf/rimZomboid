import { expect, test } from 'vitest';
import { addInto, emptyInventory, isEmpty, takeUpTo, weightOf } from './items';

const inv = (food = 0, bandage = 0, knife = 0, bat = 0) => ({ food, bandage, knife, bat });

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
