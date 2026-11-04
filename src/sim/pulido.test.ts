// H6c §2.6–§2.7: quien se va puede ser atacado por los zombis; en la base se come primero del
// almacén (lo de la mochila, para cuando no hay).
import { expect, test } from 'vitest';
import { EAT_BELOW } from './balance';
import { banish } from './death';
import { step } from './step';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile } from './types';
import { newZombie } from './zombies/spawn';

test('a quien se va le pueden atacar los zombis (le persiguen como a cualquiera)', () => {
  const w = emptyWorld(30, 30);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  const bea = addSurvivor(w, { x: 20, y: 20 }, 'Bea');
  w.survivors[0]!.pos = { x: 2.5, y: 2.5 };
  banish(w, bea);
  expect(w.leaving).toContain(bea);
  bea.path = Array.from({ length: 15 }, (_, i) => ({ x: 19 - i, y: 20 })); // un camino largo al borde
  const z = newZombie(w, { x: 21, y: 20 });
  w.zombies.push(z);
  for (let i = 0; i < 30; i++) step(w);
  expect(z.targetId === bea.id || bea.wounds.length > 0).toBe(true);
});

test('en la base, con hambre, come del almacén aunque lleve comida encima', () => {
  const w = emptyWorld(20, 20);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 5, y: 5 }];
  w.storage.items.food = 4;
  const ana = w.survivors[0]!;
  ana.pos = { x: w.base.rect.x + 1.5, y: w.base.rect.y + 1.5 };
  ana.carrying.food = 2;
  ana.needs.hunger = EAT_BELOW - 5;
  for (let i = 0; i < 400 && ana.needs.hunger < EAT_BELOW; i++) step(w);
  expect(ana.needs.hunger).toBeGreaterThan(EAT_BELOW);
  expect(ana.carrying.food).toBe(2);
  expect(w.storage.items.food).toBe(3);
});
