// H5b2 §3: rellenar lo que falta (su «Llevar siempre» y las listas de sus bolsas) y las bolsas
// guardadas en el almacén (Transportar); lo de las bolsas guardadas no son existencias.
import { expect, test } from 'vitest';
import { newBag, personal } from './bags';
import { totalFood } from './colony';
import { checkInvariants } from './invariants';
import { packJob, startPackBag, supplyJob, takeSupplies } from './jobs/supplies';
import { capacityKg } from './skills';
import { step } from './step';
import { addBase, emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type World } from './types';
import { findWork } from './work';

/** Ana en la base, junto al almacén, sin más trabajo; el almacén con comida y vendas. */
function world(): { w: World; s: Survivor } {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  addBase(w, { x: 0, y: 0, w: 12, h: 12 });
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.food = 10;
  w.storage.items.bandage = 10;
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  s.carrying.bandage = 2;
  return { w, s };
}

test('en la base, si le falta algo de su «Llevar siempre», va al almacén a por ello', () => {
  const { w, s } = world();
  expect(supplyJob(s, w)).toBeNull();
  s.keep = { bandage: 2, food: 2 };
  expect(supplyJob(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'takeSupplies' } });
  expect(findWork(s, w)).toMatchObject({ then: { type: 'takeSupplies' } });
  takeSupplies(s, w);
  expect(s.carrying.food).toBe(2);
  expect(w.storage.items.food).toBe(8);
  expect(supplyJob(s, w)).toBeNull();
});

test('la lista de una bolsa puesta se rellena primero; lo suyo, después (y en la bolsa)', () => {
  const { w, s } = world();
  s.carrying.bandage = 0;
  const b = newBag(w, 'schoolBag');
  b.list = { bandage: 3 };
  s.bags.back = b;
  takeSupplies(s, w);
  expect(b.items.bandage).toBe(5); // 3 de la lista y sus 2
  expect(personal(s, 'bandage')).toBe(2);
  expect(w.storage.items.bandage).toBe(5);
  expect(supplyJob(s, w)).toBeNull();
});

test('no va si no le cabe, si no hay en el almacén o si no está en la base', () => {
  const { w, s } = world();
  s.keep = { food: 1 };
  s.carrying.thread = Math.ceil(capacityKg(s) / 0.01); // manos llenas (hilo)
  expect(supplyJob(s, w)).toBeNull();
  s.carrying.thread = 0;
  w.storage.items.food = 0;
  expect(supplyJob(s, w)).toBeNull();
  w.storage.items.food = 3;
  w.base.rect = { x: 0, y: 0, w: 2, h: 2 };
  expect(supplyJob(s, w)).toBeNull();
});

test('Transportar llena las bolsas guardadas con lista; lo de dentro ya no son existencias', () => {
  const { w, s } = world();
  s.work.haul = true;
  s.bags.back = newBag(w, 'hikingPack'); // (si no, iría a ponérsela)
  const b = newBag(w, 'hikingPack');
  b.list = { food: 4, bandage: 2 };
  w.storage.items.pieces.push(b);
  const before = totalFood(w);
  expect(packJob(s, w)).toMatchObject({ then: { type: 'packBag', pieceId: b.id } });
  expect(findWork(s, w)).toMatchObject({ then: { type: 'packBag', pieceId: b.id } });
  startPackBag(s, w, b.id);
  expect(b.items).toMatchObject({ food: 4, bandage: 2 });
  expect(w.storage.items).toMatchObject({ food: 6, bandage: 8 });
  expect(totalFood(w)).toBe(before - 4); // lo de la bolsa guardada no cuenta
  expect(packJob(s, w)).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
});

test('dos que transportan no van a por la misma bolsa; y al final la bolsa queda llena', () => {
  const { w, s } = world();
  s.work.haul = true;
  const b = newBag(w, 'schoolBag');
  b.list = { food: 2 };
  w.storage.items.pieces.push(b);
  s.action = { type: 'moveTo', target: { x: 1, y: 1 }, then: { type: 'packBag', pieceId: b.id } };
  const other = {
    ...structuredClone(s),
    id: 2,
    name: 'Bea',
    action: { type: 'idle' as const, ticksLeft: 0 },
  };
  other.worn = [];
  other.bags = { waist: null, back: null, hand: null };
  w.survivors.push(other);
  expect(packJob(other, w)).toBeNull();
  for (let i = 0; i < 200 && b.items.food < 2; i++) step(w);
  expect(b.items.food).toBe(2);
});
