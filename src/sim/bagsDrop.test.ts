// H5b2 §5: cuándo caen las bolsas (morir, derribado, huyendo) y cómo se recogen.
import { expect, test } from 'vitest';
import { RISE_TICKS } from './balance';
import { isBag, newBag } from './bags';
import { knockDown } from './body';
import { leaveCorpse } from './corpses';
import { deathSystem, killSurvivor } from './death';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { startHaulActivity } from './jobs/haul';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type World } from './types';
import { findWork } from './work';

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

test('al morir, sus bolsas pasan al cuerpo con todo; si se levanta, el zombi las lleva', () => {
  const { w, s } = world();
  const back = newBag(w, 'hikingPack');
  back.items.food = 3;
  const hand = newBag(w, 'duffel');
  s.bags.back = back;
  s.bags.hand = hand;
  s.infection = { at: 0, deathAt: 1e9 };
  killSurvivor(w, s, 'infection');
  const body = w.containers.find((c) => c.kind === 'corpse')!;
  expect(body.items.pieces).toEqual(expect.arrayContaining([back, hand]));
  expect(checkInvariants(w)).toEqual([]);
  w.tick = body.risesAt! + 1;
  deathSystem(w);
  const z = w.zombies.find((x) => x.name !== undefined)!;
  expect(z.bags).toEqual(expect.arrayContaining([back, hand]));
  expect(checkInvariants(w)).toEqual([]);
  // Y al matarlo, a su cuerpo.
  w.zombies = w.zombies.filter((x) => x !== z);
  leaveCorpse(w, z);
  const corpse = w.containers.find((c) => c.kind === 'corpse' && c.items.pieces.some(isBag))!;
  expect(corpse.items.pieces).toEqual(expect.arrayContaining([back, hand]));
  expect(z.bags).toEqual([]);
  expect(checkInvariants(w)).toEqual([]);
  expect(RISE_TICKS).toBeGreaterThan(0);
});

test('derribado, la bolsa de la mano cae al suelo (las otras, no)', () => {
  const { w, s } = world();
  const hand = newBag(w, 'clothBag');
  const back = newBag(w, 'schoolBag');
  s.bags.hand = hand;
  s.bags.back = back;
  knockDown(w, s);
  expect(s.bags.hand).toBeNull();
  expect(s.bags.back).toBe(back);
  expect(w.piles.some((p) => p.items.pieces.includes(hand))).toBe(true);
  expect(s.droppedBag).toBe(hand.id);
  expect(checkInvariants(w)).toEqual([]);
});

test('sin peligro va a por su bolsa y se la vuelve a poner', () => {
  const { w, s } = world();
  const hand = newBag(w, 'duffel');
  hand.items.food = 2;
  s.bags.hand = hand;
  knockDown(w, s);
  s.action = { type: 'idle', ticksLeft: 0 };
  s.pos = { x: 9.5, y: 9.5 };
  expect(findWork(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'pickUpBag' } });
  for (let i = 0; i < 300 && s.bags.hand !== hand; i++) step(w);
  expect(s.bags.hand).toBe(hand);
  expect(hand.items.food).toBe(2);
  expect(s.droppedBag).toBeNull();
  expect(w.bagLog.recovered).toBe(1);
  expect(w.log.some((e) => e.kind === 'bagRecovered' && e.survivorId === s.id)).toBe(true);
  expect(w.piles.every((p) => !p.items.pieces.includes(hand))).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('Transportar lleva al almacén la bolsa del suelo (en la mano) y la deja allí', () => {
  const { w, s } = world();
  s.work.haul = true;
  const duffel = newBag(w, 'duffel');
  duffel.items.food = 6; // 3 kg
  duffel.list = { food: 2 };
  w.piles.push({
    id: w.nextId++,
    pos: { x: 5, y: 5 },
    items: { ...emptyInventory(), pieces: [duffel] },
  });
  const pile = w.piles.at(-1)!;
  startHaulActivity(s, w, { type: 'pickUp', pileId: pile.id });
  expect(s.bags.hand).toBe(duffel);
  for (let i = 0; i < 400 && s.bags.hand === duffel; i++) step(w);
  expect(s.bags.hand).toBeNull();
  expect(w.storage.items.pieces).toContain(duffel);
  expect(duffel.items.food).toBe(2); // lo de su lista
  expect(w.storage.items.food).toBe(54);
  expect(checkInvariants(w)).toEqual([]);
});

test('revisión: si su bolsa fijada de la mano se la lleva otro, el hueco deja de estar fijado', () => {
  const { w, s } = world();
  const hand = newBag(w, 'duffel');
  s.bags.hand = hand;
  s.bagsPinned = ['hand'];
  knockDown(w, s);
  // Se la lleva otro al almacén.
  const pile = w.piles.find((p) => p.items.pieces.includes(hand))!;
  pile.items.pieces = [];
  w.storage.items.pieces.push(hand);
  s.action = { type: 'idle', ticksLeft: 0 };
  expect(findWork(s, w)).not.toMatchObject({ then: { type: 'pickUpBag' } });
  expect(s.bagsPinned).toEqual([]);
  expect(findWork(s, w)).toMatchObject({ then: { type: 'bags' } }); // y vuelve a por ella
});
