// H5b2 §3: listas de las bolsas, «Llevar siempre» y descargar en el almacén.
import { expect, test } from 'vitest';
import { effectiveKeep, effectiveList, newBag, personal, unloadAt, unloadable } from './bags';
import { newGarment } from './clothes';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { hasCargo } from './jobs/medical';
import { issue, ordersSystem } from './orders';
import { activitiesSystem } from './systems/activities';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type World } from './types';
import { findWork } from './work';

function ana(): { w: World; s: Survivor } {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.carrying.bandage = 0;
  w.storage.items.food = 0;
  return { w, s };
}

test('al descargar: de la bolsa sale todo menos lo de su lista; se queda con su «Llevar siempre»', () => {
  const { w, s } = ana();
  const b = newBag(w, 'schoolBag');
  b.list = { bandage: 2 };
  b.items.bandage = 3;
  b.items.food = 2;
  const cap = newGarment(w, 'cap');
  b.items.pieces.push(cap);
  s.bags.back = b;
  s.carrying.thread = 2;
  s.carrying.bandage = 1;
  s.keep = { bandage: 2 };
  unloadAt(w, s);
  expect(b.items.bandage).toBe(4); // las 2 de la lista y sus 2 de «Llevar siempre», en la bolsa
  expect(personal(s, 'bandage')).toBe(2);
  expect(s.carrying.thread + s.carrying.bandage + b.items.food).toBe(0);
  expect(w.storage.items).toMatchObject({ food: 2, thread: 2, bandage: 0 });
  expect(w.storage.items.pieces).toEqual([cap]);
  expect(checkInvariants(w)).toEqual([]);
});

test('sin bolsa, «Llevar siempre» va en las manos (las 2 vendas de siempre)', () => {
  const { w, s } = ana();
  s.carrying.bandage = 5;
  s.carrying.food = 1;
  unloadAt(w, s);
  expect(s.carrying.bandage).toBe(2);
  expect(s.carrying.food).toBe(0);
  expect(w.storage.items.bandage).toBe(3);
});

test('una bolsa que lleva en las manos se queda en el almacén con lo de su lista dentro', () => {
  const { w, s } = ana();
  const b = newBag(w, 'duffel');
  b.list = { food: 1 };
  b.items.food = 3;
  s.carrying.pieces.push(b);
  unloadAt(w, s);
  expect(w.storage.items.pieces).toEqual([b]);
  expect(b.items.food).toBe(1);
  expect(w.storage.items.food).toBe(2);
});

test('¿tiene algo que descargar? No, si solo lleva lo de las listas y su «Llevar siempre»', () => {
  const { w, s } = ana();
  const b = newBag(w, 'fannyPack');
  b.list = { painkillers: 1 };
  b.items.painkillers = 1;
  s.bags.waist = b;
  s.carrying.bandage = 2;
  expect(unloadable(s)).toBe(false);
  expect(hasCargo(s)).toBe(false);
  b.items.food = 1;
  expect(hasCargo(s)).toBe(true);
  b.items.food = 0;
  b.items.pieces.push(newGarment(w, 'cap'));
  expect(hasCargo(s)).toBe(true);
});

test('descargar en el almacén usa las listas (la acción de siempre)', () => {
  const { w, s } = ana();
  const b = newBag(w, 'schoolBag');
  b.items.food = 4;
  s.bags.back = b;
  s.action = { type: 'unload', ticksLeft: 1 };
  activitiesSystem(w);
  expect(b.items.food).toBe(0);
  expect(w.storage.items.food).toBe(4);
});

test('órdenes: lista de una bolsa (puesta o guardada) y «Llevar siempre», también en pausa', () => {
  const { w, s } = ana();
  const worn = newBag(w, 'schoolBag');
  s.bags.back = worn;
  const stored = newBag(w, 'hikingPack');
  w.storage.items.pieces.push(stored);
  issue(w, { type: 'setBagList', pieceId: worn.id, item: 'food', n: 3 });
  issue(w, { type: 'setBagList', pieceId: stored.id, item: 'bandage', n: 4 });
  issue(w, { type: 'setKeep', survivorId: s.id, item: 'painkillers', n: 1 });
  expect(effectiveList(w, worn)).toEqual({ food: 3 });
  expect(effectiveKeep(w, s)).toEqual({ bandage: 2, painkillers: 1 });
  expect(worn.list).toEqual({}); // aún no se ha aplicado
  ordersSystem(w);
  expect(worn.list).toEqual({ food: 3 });
  expect(stored.list).toEqual({ bandage: 4 });
  expect(s.keep).toEqual({ bandage: 2, painkillers: 1 });
  issue(w, { type: 'setBagList', pieceId: worn.id, item: 'food', n: 0 });
  issue(w, { type: 'setKeep', survivorId: s.id, item: 'bandage', n: 0 });
  issue(w, { type: 'setKeep', survivorId: s.id, item: 'food', n: -2 }); // no vale
  issue(w, { type: 'setBagList', pieceId: 999, item: 'food', n: 1 }); // no existe
  ordersSystem(w);
  expect(worn.list).toEqual({});
  expect(s.keep).toEqual({ painkillers: 1 });
  expect(checkInvariants(w)).toEqual([]);
});

test('si en el almacén no queda comida, lleva antes la de sus bolsas (salvo la de su lista)', () => {
  const { w, s } = ana();
  w.grid.tiles.fill(Tile.Floor);
  w.storage.items.food = 0;
  s.work.loot = true;
  const b = newBag(w, 'schoolBag');
  b.list = { food: 1 };
  b.items.food = 1;
  s.bags.back = b;
  s.carrying.bandage = 2;
  s.carrying.thread = 1; // algo que descargar
  w.containers.push({
    id: w.nextId++,
    houseId: 1,
    pos: { x: 3, y: 3 },
    kind: 'shelf',
    items: { ...emptyInventory(), cloth: 2 },
    searched: true,
    designated: true,
    reservedBy: null,
  });
  expect(findWork(s, w)).toMatchObject({ then: { type: 'search' } }); // la de su lista, no
  b.items.food = 3; // 2 de más
  expect(findWork(s, w)).toMatchObject({ then: { type: 'unload' } });
});

test('revisión: al bajar la lista de una bolsa guardada, lo que sobra vuelve al almacén', () => {
  const { w } = ana();
  const b = newBag(w, 'hikingPack');
  b.list = { food: 10 };
  b.items.food = 10;
  w.storage.items.pieces.push(b);
  issue(w, { type: 'setBagList', pieceId: b.id, item: 'food', n: 4 });
  ordersSystem(w);
  expect(b.items.food).toBe(4);
  expect(w.storage.items.food).toBe(6);
  expect(checkInvariants(w)).toEqual([]);
});
