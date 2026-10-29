// H4d §6: puertas atrancadas (forzarlas con palanca) y romper ventanas.
import { expect, test } from 'vitest';
import { BUILD, BUILDINGS, NOISE, PRY_TICKS, TICKS_PER_HOUR } from './balance';
import { canPlace } from './build';
import { checkInvariants } from './invariants';
import { workOnBlueprint } from './jobs/build';
import { setTile } from './map/grid';
import { regionOf } from './path/astar';
import { step } from './step';
import { addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import { Tile, type World } from './types';
import { findWork } from './work';
import { createWorld } from './world';
import { newZombie } from './zombies/spawn';

test('al crear el mapa, una de cada cuatro puertas de casa está atrancada (la de la base, nunca; las demás, según el tipo)', () => {
  let locked = 0;
  let houses = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const w = createWorld(seed);
    expect(w.grid.tiles[w.base.door.y * w.grid.width + w.base.door.x]).toBe(Tile.Door);
    for (const h of w.houses) {
      if (h.kind !== 'house') continue;
      houses++;
      const t = w.grid.tiles[h.door.y * w.grid.width + h.door.x];
      expect([Tile.Door, Tile.LockedDoor]).toContain(t);
      if (t === Tile.LockedDoor) locked++;
    }
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(BUILDINGS.house.locked).toBe(0.25);
  expect(locked / houses).toBeGreaterThan(0.12);
  expect(locked / houses).toBeLessThan(0.4);
});

/**
 * Una casa de 5×5 (muros, puerta atrancada en (6, 4) y un armario marcado dentro) y Ana fuera, en
 * el almacén (1, 4).
 */
function scene(): World {
  const w = emptyWorld(14, 10);
  w.seen.fill(1);
  for (let y = 2; y <= 6; y++)
    for (let x = 6; x <= 10; x++)
      setTile(w.grid, x, y, x === 6 || x === 10 || y === 2 || y === 6 ? Tile.Wall : Tile.Floor);
  setTile(w.grid, 6, 4, Tile.LockedDoor);
  w.houses = [{ id: 1, kind: 'house', rect: { x: 6, y: 2, w: 5, h: 5 }, door: { x: 6, y: 4 } }];
  w.containers = [
    {
      id: 7,
      houseId: 1,
      pos: { x: 8, y: 4 },
      kind: 'wardrobe',
      items: { ...w.storage.items, food: 3 },
      searched: false,
      designated: true,
      reservedBy: null,
    },
  ];
  w.common.woodLog.start = 0;
  w.storage.tiles = [{ x: 1, y: 4 }];
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 4.5 };
  s.work = {
    heal: false,
    social: false,
    build: false,
    craft: false,
    haul: false,
    chop: false,
    loot: true,
  };
  s.equipped = null;
  return w;
}

test('nadie pasa por una puerta atrancada: lo de dentro no se puede saquear', () => {
  const w = scene();
  expect(regionOf(w.grid, 8, 4)).not.toBe(regionOf(w.grid, 1, 4));
  expect(findWork(w.survivors[0]!, w)).toBeNull(); // sin palanca, nada que hacer
});

test('con una palanca en el almacén: la coge, va a la puerta, la fuerza (30 min con nivel 5) y la casa se abre', () => {
  const w = scene();
  w.storage.items.crowbar = 1;
  const s = w.survivors[0]!;
  // Sin arma, la palanca es lo mejor del almacén: la coge como arma o para forzar.
  const first = findWork(s, w);
  expect(['swapWeapon', 'takeCrowbar']).toContain(first?.type === 'moveTo' ? first.then?.type : '');
  const z = newZombie(w, { x: 3, y: 8 }); // lo bastante cerca para oír los golpes
  z.state = 'wander';
  w.zombies.push(z);
  let heard = false;
  let pryTicks = 0;
  for (let i = 0; i < 2 * TICKS_PER_HOUR && w.grid.tiles[4 * 14 + 6] === Tile.LockedDoor; i++) {
    step(w);
    if (s.action.type === 'pry') pryTicks++;
    if ((z.state as string) === 'alert') heard = true;
    z.state = 'wander';
    z.goal = null;
    z.pos = { x: 3.5, y: 8.5 };
    z.path = [];
    z.cooldown = 999; // solo está para oír: que no le hiera (H5: las heridas le frenarían)
  }
  expect(w.grid.tiles[4 * 14 + 6]).toBe(Tile.Door);
  expect(Math.abs(pryTicks - PRY_TICKS)).toBeLessThanOrEqual(1);
  expect(s.equipped).toBe('crowbar');
  expect(heard).toBe(true);
  expect(s.skills.loot.xp).toBeGreaterThanOrEqual(PRY_TICKS - 1);
  expect(
    w.common.log.some((e) => e.kind === 'forced' && e.survivorId === s.id && e.houseId === 1),
  ).toBe(true);
  expect(regionOf(w.grid, 8, 4)).toBe(regionOf(w.grid, 1, 4));
  expect(checkInvariants(w)).toEqual([]);
});

test('con la palanca en la mano o en la carga va directamente; sin casa marcada, no', () => {
  const w = scene();
  const s = w.survivors[0]!;
  s.carrying.crowbar = 1;
  expect(findWork(s, w)).toMatchObject({ then: { type: 'pry', door: 4 * 14 + 6 } });
  s.carrying.crowbar = 0;
  s.equipped = 'crowbar';
  expect(findWork(s, w)).toMatchObject({ then: { type: 'pry' } });
  w.containers[0]!.designated = false;
  expect(findWork(s, w)).toBeNull();
});

test('con una palanca en la mano no la cambia por otra arma mejor mientras haya puertas que forzar', () => {
  const w = scene();
  const s = w.survivors[0]!;
  s.equipped = 'crowbar';
  w.storage.items.machete = 1;
  expect(findWork(s, w)).toMatchObject({ then: { type: 'pry' } });
  w.containers[0]!.designated = false;
  expect(findWork(s, w)).toMatchObject({ then: { type: 'swapWeapon' } });
});

test('los zombis la rompen como una puerta, pero aguanta 150', () => {
  const w = scene();
  const s = w.survivors[0]!;
  s.health = 0; // en el suelo: no pelea ni la ven
  s.action = { type: 'downed', until: 1e9 };
  w.zombies.push(newZombie(w, { x: 5, y: 4 }));
  expect(w.damage).toEqual({});
  for (let i = 0; i < 6 * TICKS_PER_HOUR && w.grid.tiles[4 * 14 + 6] === Tile.LockedDoor; i++) {
    w.zombies[0]!.state = 'alert';
    w.zombies[0]!.goal = { x: 8, y: 4 };
    step(w);
  }
  expect(w.grid.tiles[4 * 14 + 6]).toBe(Tile.BrokenDoor);
});

test('romper ventana: plano en ventanas (no tapiadas); deja una ventana rota, mucho ruido y sin cortinas', () => {
  const w = withoutZombies(scene());
  setTile(w.grid, 8, 2, Tile.Window);
  setTile(w.grid, 9, 2, Tile.CurtainedWindow);
  setTile(w.grid, 7, 2, Tile.BoardedWindow);
  w.curtains = [2 * 14 + 9, 2 * 14 + 7];
  expect(canPlace(w, 'smashWindow', { x: 8, y: 2 })).toBe(true);
  expect(canPlace(w, 'smashWindow', { x: 9, y: 2 })).toBe(true);
  expect(canPlace(w, 'smashWindow', { x: 7, y: 2 })).toBe(false);
  expect(canPlace(w, 'smashWindow', { x: 8, y: 6 })).toBe(false); // muro
  expect(BUILD.smashWindow).toEqual({ wood: 0, ticks: 10 });
  const s = w.survivors[0]!;
  s.work.build = true;
  s.pos = { x: 9.5, y: 1.5 };
  const z = newZombie(w, { x: 9, y: 9 }); // a 8 casillas: lo oye (12)
  w.zombies.push(z);
  w.blueprints.push({ id: 60, kind: 'smashWindow', pos: { x: 9, y: 2 }, wood: 0, progress: 10 });
  expect(workOnBlueprint(w, s, 60)).toBe(true);
  expect(w.grid.tiles[2 * 14 + 9]).toBe(Tile.BrokenWindow);
  expect(w.curtains).toEqual([2 * 14 + 7]);
  expect(z.state).toBe('alert');
  expect(NOISE.broken).toBe(12);
  expect(checkInvariants(w)).toEqual([]);
});

test('quien no saquea no se queda la única palanca si hay puertas que forzar: la devuelve y Ana fuerza la puerta (H4d)', () => {
  const w = withoutZombies(scene());
  const ana = w.survivors[0]!;
  ana.equipped = 'machete';
  const bea = addSurvivor(w, { x: 2, y: 4 });
  bea.work = {
    heal: false,
    social: false,
    build: false,
    craft: false,
    haul: false,
    chop: false,
    loot: false,
  };
  bea.equipped = 'knife';
  w.storage.items.crowbar = 1;
  w.containers[0]!.designated = false; // aún nada marcado: la palanca es una buena arma
  for (let i = 0; i < TICKS_PER_HOUR; i++) step(w);
  expect(bea.equipped).toBe('crowbar');
  w.containers[0]!.designated = true;
  for (let i = 0; i < 6 * TICKS_PER_HOUR && w.grid.tiles[4 * 14 + 6] === Tile.LockedDoor; i++)
    step(w);
  expect(w.grid.tiles[4 * 14 + 6]).toBe(Tile.Door);
  expect(bea.equipped).not.toBe('crowbar');
  expect(checkInvariants(w)).toEqual([]);
});
