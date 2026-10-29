// H4d §3: cortinas — vista y hoguera, correrlas, descolgarlas, colgarlas, tapiar y romper.
import { expect, test } from 'vitest';
import { BUILD, TICKS_PER_HOUR } from './balance';
import { canPlace, cancelBlueprint } from './build';
import { threatsOf } from './danger';
import { checkInvariants } from './invariants';
import { workOnBlueprint } from './jobs/build';
import { haulJob, startHaulActivity } from './jobs/haul';
import { setTile } from './map/grid';
import { visibleCampfire } from './noise';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile, type BuildKind, type World } from './types';
import { zombieSees } from './zombies/brain';
import { newZombie } from './zombies/spawn';

/** Un muro en la columna 4 con una ventana con cortinas en (4, 4). Ana dentro, en (2, 4). */
function world(): World {
  const w = emptyWorld(10, 10);
  w.seen.fill(1);
  for (let y = 0; y < 10; y++) setTile(w.grid, 4, y, Tile.Wall);
  setTile(w.grid, 4, 4, Tile.Window);
  w.curtains = [4 * 10 + 4];
  w.survivors[0]!.pos = { x: 2.5, y: 4.5 };
  return w;
}

const WIN = { x: 4, y: 4 };

/** Un plano listo (con lo que necesite) y Ana al lado trabajando en él. */
function finish(w: World, kind: BuildKind) {
  const b = {
    id: w.common.nextId++,
    kind,
    pos: { ...WIN },
    wood: 0,
    progress: BUILD[kind].ticks,
    curtains: kind === 'hangCurtains' ? 1 : 0,
  };
  w.blueprints.push(b);
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 4.5 };
  s.skills.build.level = 0; // ninguno de estos falla
  expect(workOnBlueprint(w, s, b.id)).toBe(true);
  return b;
}

test('con las cortinas corridas no se ve en ningún sentido (ni la hoguera de noche)', () => {
  const w = world();
  const s = w.survivors[0]!;
  const z = newZombie(w, { x: 6, y: 4 });
  w.zombies.push(z);
  expect(zombieSees(w, z, s.pos)).toBe(true);
  expect(threatsOf(w, s)).toEqual([z]);
  setTile(w.grid, 4, 4, Tile.CurtainedWindow);
  expect(zombieSees(w, z, s.pos)).toBe(false);
  expect(threatsOf(w, s)).toEqual([]);
  // La hoguera de dentro, de noche.
  w.tick = 14 * TICKS_PER_HOUR; // 22:00
  w.furniture.push({ id: 90, kind: 'campfire', pos: { x: 2, y: 4 } });
  expect(visibleCampfire(w, z)).toBeNull();
  setTile(w.grid, 4, 4, Tile.Window);
  expect(visibleCampfire(w, z)).toEqual({ x: 2, y: 4 });
});

test('dónde va cada plano: correr y descolgar, en ventanas con cortinas; colgar, en las que no tienen', () => {
  const w = world();
  expect(canPlace(w, 'curtains', WIN)).toBe(true);
  expect(canPlace(w, 'takeDownCurtains', WIN)).toBe(true);
  expect(canPlace(w, 'hangCurtains', WIN)).toBe(false);
  setTile(w.grid, 4, 4, Tile.CurtainedWindow);
  expect(canPlace(w, 'curtains', WIN)).toBe(true);
  expect(canPlace(w, 'takeDownCurtains', WIN)).toBe(true);
  setTile(w.grid, 4, 4, Tile.Window);
  w.curtains = [];
  expect(canPlace(w, 'curtains', WIN)).toBe(false);
  expect(canPlace(w, 'takeDownCurtains', WIN)).toBe(false);
  expect(canPlace(w, 'hangCurtains', WIN)).toBe(true);
  // En una tapiada, nada de esto.
  setTile(w.grid, 4, 4, Tile.BoardedWindow);
  w.curtains = [44];
  for (const k of ['curtains', 'takeDownCurtains', 'hangCurtains'] as const)
    expect(canPlace(w, k, WIN)).toBe(false);
});

test('correr y abrir las cortinas', () => {
  const w = world();
  finish(w, 'curtains');
  expect(w.grid.tiles[44]).toBe(Tile.CurtainedWindow);
  finish(w, 'curtains');
  expect(w.grid.tiles[44]).toBe(Tile.Window);
  expect(w.curtains).toEqual([44]);
  expect(checkInvariants(w)).toEqual([]);
});

test('descolgarlas: la ventana se queda sin cortinas y las cortinas, en el suelo junto a quien las quita', () => {
  const w = world();
  setTile(w.grid, 4, 4, Tile.CurtainedWindow);
  finish(w, 'takeDownCurtains');
  expect(w.grid.tiles[44]).toBe(Tile.Window);
  expect(w.curtains).toEqual([]);
  expect(w.piles).toHaveLength(1);
  expect(w.piles[0]!.items.curtains).toBe(1);
  expect(w.piles[0]!.pos).toEqual({ x: 3, y: 4 });
  expect(checkInvariants(w)).toEqual([]);
});

test('colgarlas: hacen falta unas cortinas, que trae quien acarrea desde el almacén', () => {
  const w = world();
  w.curtains = [];
  w.storage.items.curtains = 1;
  const b = {
    id: w.common.nextId++,
    kind: 'hangCurtains' as const,
    pos: { ...WIN },
    wood: 0,
    progress: 0,
    curtains: 0,
  };
  w.blueprints.push(b);
  const s = w.survivors[0]!;
  // Sin las cortinas no se trabaja en él.
  s.pos = { x: 3.5, y: 4.5 };
  expect(workOnBlueprint(w, s, b.id)).toBe(true);
  expect(b.progress).toBe(0);
  // Quien acarrea va a por ellas y las entrega.
  const h = addSurvivor(w, { x: 0, y: 9 });
  expect(haulJob(h, w)).toMatchObject({ then: { type: 'fetchWood', blueprintId: b.id } });
  h.pos = { x: 0.5, y: 9.5 };
  startHaulActivity(h, w, { type: 'fetchWood', blueprintId: b.id });
  expect(h.carrying.curtains).toBe(1);
  expect(w.storage.items.curtains).toBe(0);
  h.pos = { x: 3.5, y: 3.5 };
  startHaulActivity(h, w, { type: 'deliver', blueprintId: b.id });
  expect(b.curtains).toBe(1);
  expect(h.carrying.curtains).toBe(0);
  // Y al terminar, la ventana tiene cortinas (abiertas).
  w.blueprints = [];
  finish(w, 'hangCurtains');
  expect(w.curtains).toEqual([44]);
  expect(w.grid.tiles[44]).toBe(Tile.Window);
  expect(checkInvariants(w)).toEqual([]);
});

test('cancelar un plano de colgar deja en el suelo las cortinas que ya tenía', () => {
  const w = world();
  w.curtains = [];
  w.blueprints.push({
    id: 50,
    kind: 'hangCurtains',
    pos: { ...WIN },
    wood: 0,
    progress: 0,
    curtains: 1,
  });
  cancelBlueprint(w, 50);
  expect(w.piles.reduce((n, p) => n + p.items.curtains, 0)).toBe(1);
});

test('tapiar una ventana con cortinas (corridas o no) las deja dentro; al quitar las tablas, siguen', () => {
  const w = world();
  setTile(w.grid, 4, 4, Tile.CurtainedWindow);
  expect(canPlace(w, 'board', WIN)).toBe(true);
  w.common.woodLog.chopped += BUILD.board.wood;
  w.survivors[0]!.skills.build.level = 10;
  const b = {
    id: w.common.nextId++,
    kind: 'board' as const,
    pos: { ...WIN },
    wood: BUILD.board.wood,
    progress: BUILD.board.ticks,
  };
  w.blueprints.push(b);
  w.survivors[0]!.pos = { x: 3.5, y: 4.5 };
  workOnBlueprint(w, w.survivors[0]!, b.id);
  expect(w.grid.tiles[44]).toBe(Tile.BoardedWindow);
  expect(w.curtains).toEqual([44]);
  finish(w, 'unboard');
  expect(w.grid.tiles[44]).toBe(Tile.Window);
  expect(w.curtains).toEqual([44]);
});

test('invariante: un plano no tiene más cortinas de las que necesita', () => {
  const w = world();
  w.curtains = [];
  w.blueprints.push({
    id: 51,
    kind: 'hangCurtains',
    pos: { ...WIN },
    wood: 0,
    progress: 0,
    curtains: 1,
  });
  expect(checkInvariants(w)).toEqual([]);
  w.blueprints[0]!.curtains = 2;
  expect(checkInvariants(w).join()).toMatch(/plano 51 \(hangCurtains\): cortinas 2/);
});
