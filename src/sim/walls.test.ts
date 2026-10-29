// Revisión final de H4a: muros que se terminan con gente caminando, camas de los recién llegados,
// constructores que se bloquean y la gripe con "Que descanse".
import { expect, test } from 'vitest';
import { BUILD } from './balance';
import { baseLayout } from './base';
import { emptyInventory } from './items';
import { workOnBlueprint } from './jobs/build';
import { standBeside } from './jobs/stand';
import { getTile, isWalkable, setTile } from './map/grid';
import { findPath } from './path/astar';
import { dropPile } from './piles';
import { decisionsSystem } from './systems/decisions';
import { acceptStrangers } from './systems/strangers';
import { movementSystem } from './systems/movement';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type World } from './types';
import { findWork } from './work';
import { createWorld, tileOf } from './world';

function walkTo(w: World, s: Survivor, to: { x: number; y: number }) {
  s.path = findPath(w.grid, tileOf(s.pos), to)!;
  s.action = { type: 'moveTo', target: to };
}

/** Avanza el movimiento comprobando que nunca pisa una casilla no transitable. */
function walk(w: World, s: Survivor, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    movementSystem(w);
    const t = tileOf(s.pos);
    expect(isWalkable(w.grid, t.x, t.y), `tick ${i}: en (${t.x}, ${t.y})`).toBe(true);
  }
}

test('un muro que se termina en su camino: lo rodea, sin atravesarlo', () => {
  const w = emptyWorld(7, 3);
  const s = w.survivors[0]!;
  s.pos = { x: 0.5, y: 1.5 };
  walkTo(w, s, { x: 6, y: 1 });
  walk(w, s, 8);
  setTile(w.grid, 3, 1, Tile.WoodWall);
  walk(w, s, 200);
  expect(tileOf(s.pos)).toEqual({ x: 6, y: 1 });
  expect(s.action.type).not.toBe('moveTo');
});

test('un muro que se termina justo en su destino: se para fuera y vuelve a decidir', () => {
  const w = emptyWorld(7, 3);
  const s = w.survivors[0]!;
  s.pos = { x: 0.5, y: 1.5 };
  walkTo(w, s, { x: 5, y: 1 });
  walk(w, s, 8);
  setTile(w.grid, 5, 1, Tile.WoodWall);
  walk(w, s, 200);
  expect(s.action).toEqual({ type: 'idle', ticksLeft: 0 });
  expect(s.path).toEqual([]);
});

test('un muro no se termina mientras alguien va a pisar su casilla', () => {
  const w = emptyWorld(7, 3);
  const builder = w.survivors[0]!;
  builder.pos = { x: 3.5, y: 0.5 };
  const b = { id: 50, kind: 'woodWall' as const, pos: { x: 3, y: 1 }, wood: 2, progress: 0 };
  b.progress = BUILD.woodWall.ticks;
  w.blueprints.push(b);
  w.common.woodLog.start = 2;
  builder.action = { type: 'build', blueprintId: b.id };
  const walker = addSurvivor(w, { x: 2, y: 1 });
  walker.path = [
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ];
  walker.action = { type: 'moveTo', target: { x: 4, y: 1 } };
  expect(workOnBlueprint(w, builder, b.id)).toBe(false);
  walker.path = [];
  walker.pos = { x: 4.5, y: 1.5 };
  expect(workOnBlueprint(w, builder, b.id)).toBe(true);
  expect(getTile(w.grid, 3, 1)).toBe(Tile.WoodWall);
});

test('si se queda dentro de algo que no se pisa, el camino sale por la casilla de al lado', () => {
  const w = emptyWorld(7, 3);
  for (let i = 0; i < w.grid.tiles.length; i++) w.grid.tiles[i] = Tile.Floor; // para pasear
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 1.5 };
  setTile(w.grid, 3, 1, Tile.WoodWall);
  decisionsSystem(w);
  expect(s.action.type).toBe('moveTo');
  expect(s.path.length).toBeGreaterThan(0);
  const first = s.path[0]!;
  expect(isWalkable(w.grid, first.x, first.y)).toBe(true);
  expect(Math.max(Math.abs(first.x - 3), Math.abs(first.y - 1))).toBe(1);
});

function freeSlots(w: World) {
  return baseLayout(w.base).beds.filter(
    (p) => !w.beds.some((b) => b.pos.x === p.x && b.pos.y === p.y),
  );
}

function newcomer(w: World): Survivor {
  const s = { ...structuredClone(w.survivors[0]!), id: 99, name: 'Zoe', bedId: null };
  w.stranger = { survivors: [s], leaving: false };
  acceptStrangers(w);
  return s;
}

test('el recién llegado no recibe una cama de serie donde se ha hecho un muro', () => {
  const w = createWorld(3);
  const [a, b] = freeSlots(w) as [{ x: number; y: number }, { x: number; y: number }];
  setTile(w.grid, a.x, a.y, Tile.WoodWall);
  const s = newcomer(w);
  expect(w.beds.find((x) => x.id === s.bedId)?.pos).toEqual(b);
});

test('ni donde hay un mueble o un plano: si no queda sitio, duerme en el suelo', () => {
  const w = createWorld(3);
  const [a, b] = freeSlots(w) as [{ x: number; y: number }, { x: number; y: number }];
  w.furniture.push({ id: w.common.nextId++, kind: 'table', pos: a });
  w.blueprints.push({ id: w.common.nextId++, kind: 'campfire', pos: b, wood: 0, progress: 0 });
  const s = newcomer(w);
  expect(s.bedId).toBeNull();
  expect(w.beds.some((x) => x.ownerId === s.id)).toBe(false);
});

test('para construir, mejor no ponerse encima de otro plano de muro o puerta (salvo sin otra)', () => {
  // Pasillo: (0) libre, (1) muro, (2) muro, (3) libre. Quien viene de la derecha a hacer el (1)
  // no se pone en el (2), que alguien tendrá que construir: da la vuelta por él hasta el (0).
  const w = emptyWorld(4, 1);
  const s = w.survivors[0]!;
  s.pos = { x: 3.5, y: 0.5 };
  for (const x of [1, 2])
    w.blueprints.push({ id: 60 + x, kind: 'woodWall', pos: { x, y: 0 }, wood: 0, progress: 0 });
  expect(standBeside(w, s, { x: 1, y: 0 })).toEqual({ x: 0, y: 0 });
  setTile(w.grid, 0, 0, Tile.Wall);
  expect(standBeside(w, s, { x: 1, y: 0 })).toEqual({ x: 2, y: 0 });
});

test('con fiebre y "Que descanse" no hace ningún trabajo (salvo terminar de descargar)', () => {
  const w = emptyWorld(8, 8);
  w.seen.fill(1);
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 1.5 };
  s.fever = {
    cause: 'flu',
    since: 0,
    stage: 'fever',
    rest: true,
    restTicks: 0,
    badLuck: false,
    checks: 0,
  };
  w.blueprints.push({ id: 70, kind: 'campfire', pos: { x: 4, y: 4 }, wood: 3, progress: 0 });
  w.common.woodLog.start = 3;
  w.piles.push({ id: 71, pos: { x: 5, y: 5 }, items: { ...emptyInventory(), wood: 2 } });
  w.common.woodLog.start += 2;
  expect(findWork(s, w)).toBeNull();
  s.equipped = 'axe'; // con árboles marcados, el hacha la devuelve, para que otro pueda talar
  setTile(w.grid, 7, 7, Tile.Tree);
  w.chopMarks = [7 * 8 + 7];
  expect(findWork(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'storeAxe' } });
  s.equipped = null;
  s.fever.rest = false;
  expect(findWork(s, w)).not.toBeNull();
});

test('un montón que no cabe al lado se deja en la casilla transitable más cercana', () => {
  const w = emptyWorld(7, 7);
  for (let y = 1; y <= 5; y++)
    for (let x = 1; x <= 5; x++) if (x !== 1 || y !== 1) setTile(w.grid, x, y, Tile.Wall);
  setTile(w.grid, 3, 3, Tile.WoodWall);
  dropPile(w, { x: 3, y: 3 }, { ...emptyInventory(), wood: 4 });
  expect(w.piles).toHaveLength(1);
  const p = w.piles[0]!;
  expect(isWalkable(w.grid, p.pos.x, p.pos.y)).toBe(true);
  expect(p.items.wood).toBe(4);
  expect(Math.max(Math.abs(p.pos.x - 3), Math.abs(p.pos.y - 3))).toBe(2);
});
