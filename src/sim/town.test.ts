// H4f: el pueblo — tipos de edificio, sus cifras y sus invariantes.
import { expect, test } from 'vitest';
import { BUILDINGS, LOOT } from './balance';
import { checkInvariants } from './invariants';
import { emptyWorld } from './testing/fixtures';
import { Tile, type BuildingKind, type World } from './types';
import { createWorld } from './world';

test('cifras de los edificios (spec §3): tamaño, muebles y puerta atrancada', () => {
  expect(BUILDINGS.house).toEqual({ w: [8, 12], h: [7, 10], containers: [2, 5], locked: 0.25 });
  expect(BUILDINGS.supermarket).toEqual({
    w: [14, 18],
    h: [12, 16],
    containers: [12, 20],
    locked: 0.4,
  });
  expect(BUILDINGS.pharmacy).toEqual({ w: [8, 10], h: [7, 9], containers: [3, 6], locked: 0.4 });
  expect(BUILDINGS.hardware).toEqual({ w: [10, 14], h: [8, 12], containers: [5, 8], locked: 0.4 });
  expect(BUILDINGS.police).toEqual({ w: [12, 16], h: [10, 14], containers: [5, 8], locked: 0.5 });
  expect(BUILDINGS.clothes).toEqual({ w: [10, 12], h: [8, 10], containers: [5, 8], locked: 0.4 });
  expect(BUILDINGS.gas).toEqual({ w: [8, 8], h: [6, 6], containers: [3, 5], locked: 0.25 });
  expect(BUILDINGS.farm).toEqual({ w: [14, 18], h: [10, 14], containers: [5, 8], locked: 0.15 });
  expect(BUILDINGS.warehouse).toEqual({
    w: [16, 22],
    h: [12, 16],
    containers: [10, 16],
    locked: 0.5,
  });
});

test('botín por tipo (spec §4): rangos y, para lo de "a veces", la probabilidad', () => {
  expect(LOOT.house).toEqual({
    food: [2, 5],
    bandage: [0, 1],
    wood: [0, 2],
    cloth: [0, 2],
    thread: { chance: 0.2 },
    needle: { chance: 0.05 },
    knife: { chance: 0.25 },
    bat: { chance: 0.15 },
    painkillers: { chance: 1 / 3 }, // H5
    waterBottle: { chance: 0.5 }, // H5b
  });
  expect(LOOT.supermarket).toEqual({
    food: [40, 60],
    bandage: [1, 3],
    knife: [1, 1],
    painkillers: [0, 2],
    waterBottle: [6, 12],
  });
  expect(LOOT.pharmacy).toEqual({
    food: [0, 4],
    bandage: [12, 18],
    needle: [1, 1],
    painkillers: [6, 10],
  });
  expect(LOOT.hardware).toEqual({
    bandage: [0, 2],
    wood: [16, 24],
    thread: [2, 2],
    needle: [1, 1],
    axe: [2, 2],
    crowbar: [2, 2],
    machete: [1, 1],
    knife: [1, 1],
    bucket: [2, 3], // H5b
  });
  expect(LOOT.police).toEqual({
    food: [2, 6],
    bandage: [2, 4],
    bat: [2, 2],
    crowbar: [1, 1],
    machete: [1, 1],
    painkillers: [1, 2],
  });
  expect(LOOT.clothes).toEqual({
    cloth: [20, 30],
    thread: [6, 6],
    needle: [3, 3],
    denim: [3, 6], // H5b
    leather: [2, 4],
  });
  expect(LOOT.gas).toEqual({
    food: [8, 16],
    bandage: [0, 2],
    bat: [1, 1],
    painkillers: [0, 2],
    waterBottle: [2, 6], // H5b
  });
  expect(LOOT.farm).toEqual({
    food: [8, 16],
    bandage: [0, 2],
    wood: [6, 10],
    cloth: [1, 3],
    axe: [1, 1],
    machete: [1, 1],
    bucket: [1, 2], // H5b
  });
  expect(LOOT.warehouse).toEqual({
    food: [2, 6],
    bandage: [0, 2],
    wood: [20, 30],
    cloth: [5, 10],
    crowbar: [1, 1],
    axe: [1, 1],
    bucket: [1, 2], // H5b
  });
});

test('cada edificio tiene su tipo (la base, "base") y el mundo sabe dónde está el pueblo', () => {
  const w = createWorld(3);
  expect(w.base.kind).toBe('base');
  for (const h of w.houses) expect(h.kind).not.toBe('base');
  expect(w.town.w).toBeGreaterThan(0);
  expect(w.town.x + w.town.w).toBeLessThanOrEqual(w.grid.width);
  expect(w.town.y + w.town.h).toBeLessThanOrEqual(w.grid.height);
  expect(JSON.parse(JSON.stringify(w)).town).toEqual(w.town);
});

/** Dos edificios de 5×5 separados, cada uno con un mueble dentro. */
function town(): World {
  const w = emptyWorld(20, 10);
  w.houses = [
    { id: 1, kind: 'house', rect: { x: 1, y: 1, w: 5, h: 5 }, door: { x: 3, y: 5 } },
    { id: 2, kind: 'pharmacy', rect: { x: 10, y: 1, w: 5, h: 5 }, door: { x: 12, y: 5 } },
  ];
  for (const h of w.houses)
    for (let y = h.rect.y; y < h.rect.y + h.rect.h; y++)
      for (let x = h.rect.x; x < h.rect.x + h.rect.w; x++) w.grid.tiles[y * 20 + x] = Tile.Floor;
  w.containers = [1, 2].map((id) => ({
    id,
    houseId: id,
    pos: { x: id === 1 ? 3 : 12, y: 3 },
    kind: id === 1 ? 'fridge' : 'medicine',
    items: { ...w.storage.items, food: 0 },
    searched: false,
    designated: false,
    reservedBy: null,
  }));
  return w;
}

test('invariantes: tipo válido, edificios sin solaparse y cada mueble dentro de su edificio', () => {
  const w = town();
  expect(checkInvariants(w)).toEqual([]);
  w.houses[1]!.kind = 'castle' as BuildingKind;
  expect(checkInvariants(w).join()).toMatch(/edificio 2: tipo castle/);
  w.houses[1]!.kind = 'pharmacy';
  w.houses[1]!.rect.x = 4; // pisa la casa 1
  expect(checkInvariants(w).join()).toMatch(/edificios 1 y 2 se solapan/);
  w.houses[1]!.rect.x = 10;
  w.containers[1]!.pos = { x: 7, y: 3 }; // fuera de la farmacia
  expect(checkInvariants(w).join()).toMatch(/mueble 2: fuera de su edificio 2/);
});
