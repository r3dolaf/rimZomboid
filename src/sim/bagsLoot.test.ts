// H5b2 §2, §3 y §6: saquear y recoger con bolsas; las bolsas y la hachuela en el botín.
import { expect, test } from 'vitest';
import { ITEM_WEIGHT_KG, LOOT, LOOT_BAGS, WEAPON_STATS } from './balance';
import { isBag, newBag, takeInto } from './bags';
import { newGarment } from './clothes';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { WEAPONS } from './jobs/weapons';
import { activitiesSystem } from './systems/activities';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Container, type World } from './types';
import { findWork } from './work';
import { capacityKg } from './skills';
import { createWorld } from './world';

function box(w: World, items = emptyInventory()): Container {
  const c: Container = {
    id: w.nextId++,
    houseId: 1,
    pos: { x: 2, y: 2 },
    kind: 'wardrobe',
    items,
    searched: false,
    designated: true,
    reservedBy: null,
  };
  w.containers.push(c);
  return c;
}

test('al saquear se pone la bolsa que encuentra y mete en ella lo demás', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  const from = emptyInventory();
  const bag = newBag(w, 'schoolBag');
  const cap = newGarment(w, 'cap');
  from.pieces.push(cap, bag);
  from.food = 3;
  const taken = takeInto(w, s, from, 'loot');
  expect(s.bags.back).toBe(bag);
  expect(bag.items.food).toBe(3);
  expect(bag.items.pieces).toEqual([cap]);
  expect(taken.food).toBe(3);
  expect(taken.pieces).toEqual(expect.arrayContaining([bag, cap]));
  expect(w.bagLog.found).toBe(1);
  expect(w.log.at(-1)).toMatchObject({ kind: 'bagFound', survivorId: s.id, bag: 'schoolBag' });
});

test('lo que pide la lista de una bolsa va a esa bolsa; lo demás, a la de más sitio', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  const fanny = newBag(w, 'fannyPack');
  fanny.list = { bandage: 2 };
  const pack = newBag(w, 'schoolBag');
  s.bags.waist = fanny;
  s.bags.back = pack;
  const from = { ...emptyInventory(), bandage: 3 };
  takeInto(w, s, from, 'loot');
  expect(fanny.items.bandage).toBe(2);
  expect(pack.items.bandage).toBe(1);
});

test('una bolsa que no puede ponerse ni le cabe entera: la vacía allí y se lleva lo que pueda', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.carrying.bandage = 0;
  s.bags.back = newBag(w, 'hikingPack');
  const full = newBag(w, 'hikingPack');
  full.items.wood = 11;
  full.list = { wood: 4 };
  const from = emptyInventory();
  from.pieces.push(full);
  takeInto(w, s, from, 'loot');
  // Se llena su mochila (12 kg) y las manos; la otra, vacía, se queda si no cabe.
  expect(s.bags.back!.items.wood + s.carrying.wood + from.wood).toBe(11);
  expect(full.items.wood).toBe(0);
  expect(full.list).toEqual({ wood: 4 }); // sigue siendo su lista
  const all = [...s.carrying.pieces, ...from.pieces];
  expect(all).toContain(full);
});

test('Transportar lleva en la mano la bolsa de un montón (sin mirar el atuendo)', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  const duffel = newBag(w, 'duffel');
  duffel.items.wood = 7;
  const from = emptyInventory();
  from.pieces.push(duffel);
  takeInto(w, s, from, 'haul');
  expect(s.bags.hand).toBe(duffel);
  expect(w.bagLog.found).toBe(0);
});

test('registrar un mueble usa las bolsas: lo que no cabe en las manos va a la mochila', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  const pack = newBag(w, 'hikingPack');
  s.bags.back = pack;
  const c = box(w, { ...emptyInventory(), food: 30 });
  s.action = { type: 'search', containerId: c.id, ticksLeft: 1 };
  activitiesSystem(w);
  expect(pack.items.food).toBe(24); // 12 kg
  expect(s.carrying.food).toBeGreaterThan(0);
  expect(checkInvariants(w)).toEqual([]);
});

test('botín de bolsas (spec §6) y de la hachuela', () => {
  expect(LOOT_BAGS).toEqual({
    house: { count: [0, 1], kinds: { fannyPack: 1, schoolBag: 1 } },
    clothes: { count: [2, 4], kinds: { fannyPack: 1, schoolBag: 1, duffel: 1, hikingPack: 1 } },
    hardware: { count: [0, 2], kinds: { hikingPack: 1, duffel: 1 } },
    farm: { count: [0, 2], kinds: { hikingPack: 1, duffel: 1 } },
    warehouse: { count: [0, 2], kinds: { hikingPack: 1, duffel: 1 } },
  });
  expect(LOOT.hardware.hatchet).toEqual(LOOT.hardware.axe);
  expect(LOOT.farm.hatchet).toEqual(LOOT.farm.axe);
  expect(LOOT.warehouse.hatchet).toEqual(LOOT.warehouse.axe);
  expect(WEAPON_STATS.hatchet).toEqual({ damage: 30, ticks: 15 });
  expect(ITEM_WEIGHT_KG.hatchet).toBe(1);
  expect(WEAPONS).toEqual(['machete', 'crowbar', 'hatchet', 'axe', 'bat', 'knife']);
  const w = createWorld(3);
  const bagsIn = (kind: string) =>
    w.houses
      .filter((h) => h.kind === kind)
      .map((h) =>
        w.containers
          .filter((c) => c.houseId === h.id)
          .reduce((n, c) => n + c.items.pieces.filter(isBag).length, 0),
      );
  for (const n of bagsIn('clothes')) expect(n).toBeGreaterThanOrEqual(2);
  for (const n of bagsIn('house')) expect(n).toBeLessThanOrEqual(1);
  expect(bagsIn('house').some((n) => n === 1)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('con las manos llenas sigue saqueando si le cabe algo en la bolsa', () => {
  const w = emptyWorld(10, 10);
  w.grid.tiles.fill(Tile.Floor);
  const s = w.survivors[0]!;
  s.carrying.wood = Math.floor(capacityKg(s)); // manos llenas
  const c = box(w, { ...emptyInventory(), food: 2 });
  c.searched = true;
  expect(findWork(s, w)).toMatchObject({ then: { type: 'unload' } });
  s.bags.back = newBag(w, 'schoolBag');
  expect(findWork(s, w)).toMatchObject({ then: { type: 'search', containerId: c.id } });
});

test('no vuelve a por una bolsa que su atuendo no le deja ponerse y no le cabe en las manos', () => {
  const w = emptyWorld(10, 10);
  w.grid.tiles.fill(Tile.Floor);
  const s = w.survivors[0]!;
  s.outfitId = 3; // Base: sin bolsa en la mano
  s.bags.back = newBag(w, 'hikingPack');
  s.bags.back.items.wood = 12; // llena
  w.woodLog.start += 12;
  s.carrying.thread = Math.ceil(capacityKg(s) / 0.01); // manos llenas
  const c = box(w);
  c.items.pieces.push(newBag(w, 'duffel')); // vacía: solo cabría en la mano
  c.searched = true;
  expect(findWork(s, w)).not.toMatchObject({ then: { type: 'search' } });
});

test('una bolsa que no puede ponerse se coge al final, como la ropa: antes la comida', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.carrying.bandage = 0;
  for (const o of w.outfits) o.bags = []; // ninguna bolsa en su atuendo
  const from = { ...emptyInventory(), food: 40 };
  from.pieces.push(newBag(w, 'duffel'));
  takeInto(w, s, from, 'loot');
  expect(s.carrying.food).toBe(Math.floor(capacityKg(s) / ITEM_WEIGHT_KG.food + 1e-9));
});
