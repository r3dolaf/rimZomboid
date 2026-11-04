// H6c §2.1: quien hace «Sanar» lleva una lata del almacén a un derribado con hambre.
import { expect, test } from 'vitest';
import { EAT_BELOW } from './balance';
import { checkInvariants } from './invariants';
import { step } from './step';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile } from './types';

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
    s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
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
