// H5b2 §2: ponerse las bolsas según el atuendo (la de más capacidad en cada hueco) y fijarlas.
import { expect, test } from 'vitest';
import { DRESS_TICKS } from './balance';
import { effectivePinned, newBag } from './bags';
import { checkInvariants } from './invariants';
import { bagJob, startBags } from './jobs/bags';
import { issue, ordersSystem } from './orders';
import { effectiveOutfits } from './outfits';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import { Tile, type BagKind, type Survivor, type World } from './types';
import { findWork } from './work';

/** El almacén en (1, 1) y Ana al lado, sin más trabajo que vestirse. */
function world(): { w: World; s: Survivor } {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.food = 50;
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  return { w, s };
}

const stored = (w: World, kind: BagKind) => {
  const b = newBag(w, kind);
  w.storage.items.pieces.push(b);
  return b;
};

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(w);
};

test('atuendos de partida: todas las bolsas; en la mano, Cualquiera y Saqueo, Base no', () => {
  const { w } = world();
  expect(w.common.outfits.map((o) => [o.name, o.bags.length, o.handBag])).toEqual([
    ['Cualquiera', 5, true],
    ['Saqueo', 5, true],
    ['Base', 5, false],
  ]);
});

test('va al almacén y se pone la mochila; tarda 5 minutos por bolsa', () => {
  const { w, s } = world();
  const b = stored(w, 'schoolBag');
  expect(findWork(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'bags' } });
  for (let i = 0; i < 300 && s.bags.back !== b; i++) step(w);
  expect(s.bags.back).toBe(b);
  expect(s.action).toMatchObject({ type: 'dress', ticksLeft: DRESS_TICKS - 1 });
  expect(w.storage.items.pieces).toEqual([]);
  run(w, DRESS_TICKS);
  expect(bagJob(s, w)).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
});

test('cambia por más capacidad; la de deporte, a la espalda si no hay nada mejor, si no a la mano', () => {
  const { w, s } = world();
  const school = newBag(w, 'schoolBag');
  s.bags.back = school;
  const duffel = stored(w, 'duffel');
  startBags(s, w);
  expect(s.bags.back).toBe(duffel); // 8 kg mejor que 6
  expect(w.storage.items.pieces).toContain(school);
  const hiking = stored(w, 'hikingPack');
  startBags(s, w);
  expect(s.bags.back).toBe(hiking);
  expect(s.bags.hand).toBe(duffel); // la de deporte pasa a la mano
  expect(w.storage.items.pieces).toEqual([school]);
  expect(bagJob(s, w)).toBeNull(); // la escolar no mejora nada
  expect(checkInvariants(w)).toEqual([]);
});

test('en Base no lleva bolsa en la mano; lo que su atuendo no permite se lo quita (salvo fijada)', () => {
  const { w, s } = world();
  const duffel = newBag(w, 'duffel');
  s.bags.hand = duffel;
  s.outfitId = 3; // Base
  expect(bagJob(s, w)).not.toBeNull();
  startBags(s, w);
  expect(s.bags.hand).toBeNull();
  expect(s.bags.back).toBe(duffel); // del almacén, a la espalda
  issue(w, { type: 'setOutfitBag', outfitId: 3, bag: 'duffel', on: false });
  issue(w, { type: 'pinBag', survivorId: s.id, slot: 'back', on: true });
  expect(effectivePinned(w, s)).toEqual(['back']);
  expect(effectiveOutfits(w)[2]!.bags).not.toContain('duffel');
  ordersSystem(w);
  expect(s.bagsPinned).toEqual(['back']);
  expect(bagJob(s, w)).toBeNull(); // fijada: no se la quita
  issue(w, { type: 'pinBag', survivorId: s.id, slot: 'back', on: false });
  ordersSystem(w);
  expect(bagJob(s, w)).not.toBeNull();
  startBags(s, w);
  expect(s.bags.back).toBeNull();
  issue(w, { type: 'setOutfitHandBag', outfitId: 3, on: true });
  ordersSystem(w);
  expect(w.common.outfits[2]!.handBag).toBe(true);
});

test('la mochila preparada se coge llena; en modo combate no se cambia de bolsa', () => {
  const { w, s } = world();
  const b = stored(w, 'hikingPack');
  b.list = { food: 4 };
  b.items.food = 4;
  s.drafted = true;
  expect(bagJob(s, w)).toBeNull();
  s.drafted = false;
  startBags(s, w);
  expect(s.bags.back).toBe(b);
  expect(b.items.food).toBe(4);
  expect(checkInvariants(w)).toEqual([]);
});
