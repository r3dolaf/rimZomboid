// H4d §7: cuerpos de zombi — aparecen al matar, lo que llevan, marcarlos, registrarlos y desaparecer.
import { expect, test } from 'vitest';
import {
  CORPSE_EMPTY_TICKS,
  CORPSE_ROT_TICKS,
  CORPSE_SMALL_CHANCE,
  CORPSE_WEAPON_CHANCE,
  TICKS_PER_DAY,
} from './balance';
import { canPlace } from './build';
import { colonistHit } from './combat';
import { corpsesSystem } from './corpses';
import { checkInvariants } from './invariants';
import { workOnBlueprint } from './jobs/build';
import { issue, ordersSystem } from './orders';
import { createRng } from './rng';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Container, type World } from './types';
import { newZombie } from './zombies/spawn';

function world(): World {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  return w;
}

/** Mata a un zombi en (x, y) de un golpe y devuelve su cuerpo. */
function kill(w: World, x: number, y: number): Container {
  const z = newZombie(w, { x, y });
  w.zombies.push(z);
  z.health = 1;
  const s = w.survivors[0]!;
  for (let i = 0; i < 50 && w.zombies.includes(z); i++) {
    s.skills.fight = { level: 10, xp: 0 };
    colonistHit(w, s, z);
  }
  return w.containers.at(-1)!;
}

const WEAPONS = ['knife', 'bat', 'axe', 'crowbar', 'machete'] as const;
const weapons = (c: Container) => WEAPONS.reduce((n, k) => n + c.items[k], 0);

test('al matar a un zombi queda su cuerpo en su casilla: con su ropa (H5b: ya sin telas), sin marcar', () => {
  const w = world();
  const c = kill(w, 4, 6);
  expect(c).toMatchObject({
    houseId: -1,
    kind: 'corpse',
    pos: { x: 4, y: 6 },
    searched: false,
    designated: false,
    reservedBy: null,
  });
  expect(c.items.cloth).toBe(0);
  expect(c.items.pieces.length).toBeGreaterThanOrEqual(2);
  expect(c.until).toBe(w.tick + CORPSE_ROT_TICKS);
  expect(checkInvariants(w)).toEqual([]);
});

test('lo que llevan: un arma el 10 % (cuchillo, bate, palanca, machete o hacha) y una venda o una lata el 15 %', () => {
  const w = world();
  w.zombieRng = createRng(3);
  let armed = 0;
  let small = 0;
  const kinds = new Set<string>();
  const n = 1500;
  for (let i = 0; i < n; i++) {
    const c = kill(w, 4, 6);
    const k = weapons(c);
    expect(k).toBeLessThanOrEqual(1);
    if (k > 0) {
      armed++;
      for (const x of WEAPONS) if (c.items[x] > 0) kinds.add(x);
    }
    if (c.items.bandage + c.items.food > 0) small++;
    w.containers = [];
  }
  expect(armed / n).toBeCloseTo(CORPSE_WEAPON_CHANCE, 1);
  expect(small / n).toBeCloseTo(CORPSE_SMALL_CHANCE, 1);
  expect(kinds).toEqual(new Set(WEAPONS));
  expect(w.weaponLog.fromCorpses).toBe(armed);
});

test('se marcan como cualquier mueble, y quien saquea los registra: "ha registrado un cuerpo"', () => {
  const w = world();
  const c = kill(w, 6, 6);
  issue(w, { type: 'designateContainer', containerId: c.id, on: true });
  ordersSystem(w);
  expect(c.designated).toBe(true);
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 1.5 };
  s.work = {
    heal: false,
    social: false,
    build: false,
    craft: false,
    haul: false,
    chop: false,
    loot: true,
  };
  for (let i = 0; i < 400 && !c.searched; i++) step(w);
  expect(c.searched).toBe(true);
  expect(w.log.some((e) => e.kind === 'corpseSearched' && e.survivorId === s.id)).toBe(true);
  expect(w.log.some((e) => e.kind === 'found' || e.kind === 'houseEmptied')).toBe(false);
});

test('desaparecen: registrado y vacío, al cabo de un día; si no, se pudre a los 3 días (con sus armas)', () => {
  const w = world();
  const a = kill(w, 3, 3);
  const b = kill(w, 7, 7);
  a.items = {
    ...a.items,
    cloth: 0,
    food: 0,
    bandage: 0,
    knife: 0,
    bat: 0,
    axe: 0,
    crowbar: 0,
    machete: 0,
    painkillers: 0,
    denim: 0,
    leather: 0,
    bucket: 0,
    waterBucket: 0,
    waterBottle: 0,
    pieces: [],
  };
  a.searched = true;
  b.items.machete = 1; // se pudre con ella
  w.weaponLog.fromCorpses += 1;
  corpsesSystem(w);
  expect(a.until).toBe(w.tick + CORPSE_EMPTY_TICKS);
  expect(CORPSE_EMPTY_TICKS).toBe(TICKS_PER_DAY);
  w.tick += CORPSE_EMPTY_TICKS;
  corpsesSystem(w);
  expect(w.containers).toEqual([b]);
  w.tick = b.until!;
  const rottedBefore = w.weaponLog.rotted;
  corpsesSystem(w);
  expect(w.containers).toEqual([]);
  expect(w.weaponLog.rotted).toBe(rottedBefore + weapons(b));
  expect(CORPSE_ROT_TICKS).toBe(3 * TICKS_PER_DAY);
});

test('invariante: un cuerpo está en una casilla que se pisa', () => {
  const w = world();
  const c = kill(w, 5, 5);
  expect(checkInvariants(w)).toEqual([]);
  w.grid.tiles[5 * 12 + 5] = Tile.Wall;
  expect(checkInvariants(w).join()).toMatch(new RegExp(`cuerpo ${c.id}`));
});

test('si se tapia la ventana rota en la que cayó un zombi, su cuerpo se aparta a la casilla de al lado', () => {
  const w = world();
  w.grid.tiles[5 * 12 + 5] = Tile.BrokenWindow;
  const c = kill(w, 5, 5);
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 6.5 };
  s.skills.build.level = 10;
  w.woodLog.chopped += 3;
  w.blueprints.push({ id: 70, kind: 'board', pos: { x: 5, y: 5 }, wood: 3, progress: 1000 });
  workOnBlueprint(w, s, 70);
  expect(w.grid.tiles[5 * 12 + 5]).toBe(Tile.BoardedWindow);
  expect(c.pos).not.toEqual({ x: 5, y: 5 });
  expect(Math.max(Math.abs(c.pos.x - 5), Math.abs(c.pos.y - 5))).toBeLessThanOrEqual(1);
  expect(checkInvariants(w)).toEqual([]);
});

test('un cuerpo no impide construir encima: tapar el boquete donde cayó (al terminar, se aparta) (H4d)', () => {
  const w = world();
  w.grid.tiles[4 * 12 + 4] = Tile.Rubble;
  expect(canPlace(w, 'woodWall', { x: 4, y: 4 })).toBe(true);
  kill(w, 4, 4);
  expect(canPlace(w, 'woodWall', { x: 4, y: 4 })).toBe(true);
  kill(w, 7, 7);
  expect(canPlace(w, 'campfire', { x: 7, y: 7 })).toBe(true);
});

test('no desaparece mientras alguien va a registrarlo: se va cuando ya nadie lo tiene reservado', () => {
  const w = world();
  const c = kill(w, 9, 9);
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 1.5 };
  s.action = { type: 'moveTo', target: c.pos, then: { type: 'search', containerId: c.id } };
  c.designated = true;
  c.reservedBy = s.id;
  w.tick = c.until!;
  corpsesSystem(w);
  expect(w.containers).toContain(c);
  expect(checkInvariants(w)).toEqual([]);
  s.action = { type: 'idle', ticksLeft: 0 };
  c.reservedBy = null;
  corpsesSystem(w);
  expect(w.containers).not.toContain(c);
});
