// H6c §2.1: quien hace «Sanar» lleva una lata del almacén a un derribado con hambre.
import { expect, test } from 'vitest';
import { EAT_BELOW } from './balance';
import { checkInvariants } from './invariants';
import { healStillWorth } from './jobs/heal';
import { feedJob } from './jobs/medical';
import { step } from './step';
import { addSurvivor, emptyWorld, encloseTile } from './testing/fixtures';
import { Tile } from './types';
import { newZombie } from './zombies/spawn';

function world() {
  const w = emptyWorld(20, 20);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 5, y: 5 }];
  w.storage.items.food = 3;
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 12, y: 12 }, 'Bea');
  for (const s of w.survivors) {
    for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
    s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100, thirst: 100 };
    s.nextChatAt = 1e9;
    s.carrying.food = 0;
  }
  ana.work.heal = true;
  ana.pos = { x: 4.5, y: 4.5 };
  bea.action = { type: 'downed', until: 1e12 };
  bea.needs.hunger = EAT_BELOW - 10;
  return { w, ana, bea };
}

test('a un derribado con hambre le llevan una lata (y se la come)', () => {
  const { w, bea } = world();
  for (let i = 0; i < 600 && bea.needs.hunger < EAT_BELOW; i++) step(w);
  expect(bea.needs.hunger).toBeGreaterThan(EAT_BELOW);
  expect(w.storage.items.food).toBe(2);
  expect(w.common.log.some((e) => e.kind === 'fed')).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('si ya no está derribado (o no tiene hambre), no se la llevan', () => {
  const { w, bea } = world();
  bea.needs.hunger = 90;
  for (let i = 0; i < 300; i++) step(w);
  expect(w.storage.items.food).toBe(3);
});

// Revisión final: como rescatar, nada de ir a donde hay zombis ni a quien no se puede llegar.

test('no le llevan la lata si se ven zombis cerca del derribado (y si aparecen, lo dejan)', () => {
  const { w, ana, bea } = world();
  expect(feedJob(ana, w)).not.toBeNull();
  ana.action = feedJob(ana, w)!;
  expect(healStillWorth(ana, w)).toBe(true);
  w.zombies.push(newZombie(w, { x: 13, y: 12 }));
  expect(feedJob(ana, w)).toBeNull();
  expect(healStillWorth(ana, w)).toBe(false);
  void bea;
});

test('ni a quien está fuera de la base ni a quien no se puede llegar', () => {
  const out = world();
  out.w.base.rect = { x: 0, y: 0, w: 10, h: 10 };
  expect(feedJob(out.ana, out.w)).toBeNull();
  const shut = world();
  encloseTile(shut.w, { x: 12, y: 12 });
  expect(feedJob(shut.ana, shut.w)).toBeNull();
});

test('V2: a un derribado con sed le llevan una botella del almacén (y bebe)', () => {
  const { w, bea } = world();
  bea.needs.hunger = 100;
  bea.needs.thirst = 20;
  w.storage.items.waterBottle = 1;
  for (let i = 0; i < 600 && bea.needs.thirst < 40; i++) step(w);
  expect(bea.needs.thirst).toBeGreaterThan(60);
  expect(w.storage.items.waterBottle).toBe(0);
  expect(w.storage.items.food).toBe(3);
  expect(checkInvariants(w)).toEqual([]);
});

test('V2: con sed pero sin botellas, no le llevan nada (si no tiene hambre)', () => {
  const { w, ana, bea } = world();
  bea.needs.hunger = 100;
  bea.needs.thirst = 20;
  expect(feedJob(ana, w)).toBeNull();
});
