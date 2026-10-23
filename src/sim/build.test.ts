// H4a: órdenes de talar y construir, y dónde se puede construir.
import { expect, test } from 'vitest';
import { canPlace, markedTrees, treeMarked } from './build';
import { checkInvariants } from './invariants';
import { getTile } from './map/grid';
import { issue, ordersSystem } from './orders';
import { Tile, type Point, type World } from './types';
import { createWorld } from './world';

function world(): World {
  const w = createWorld(3);
  w.seen.fill(1);
  return w;
}

/** Primera casilla de un tipo (en orden de lectura) que cumpla `extra`. */
function find(w: World, t: Tile, extra: (p: Point) => boolean = () => true): Point {
  for (let y = 0; y < w.grid.height; y++)
    for (let x = 0; x < w.grid.width; x++)
      if (getTile(w.grid, x, y) === t && extra({ x, y })) return { x, y };
  throw new Error(`no hay casilla ${t}`);
}

test('marcar y desmarcar árboles; solo árboles ya vistos', () => {
  const w = world();
  const t = find(w, Tile.Tree);
  const i = t.y * w.grid.width + t.x;
  issue(w, { type: 'markTree', x: t.x, y: t.y, on: true });
  expect(treeMarked(w, t.x, t.y)).toBe(true); // ya con la orden pendiente
  ordersSystem(w);
  expect(w.chopMarks).toEqual([i]);
  issue(w, { type: 'markTree', x: t.x, y: t.y, on: true });
  ordersSystem(w);
  expect(w.chopMarks).toEqual([i]); // sin repetir
  issue(w, { type: 'markTree', x: t.x, y: t.y, on: false });
  ordersSystem(w);
  expect(w.chopMarks).toEqual([]);
  const g = find(w, Tile.Grass);
  issue(w, { type: 'markTree', x: g.x, y: g.y, on: true });
  ordersSystem(w);
  expect(w.chopMarks).toEqual([]);
  w.seen.fill(0);
  issue(w, { type: 'markTree', x: t.x, y: t.y, on: true });
  ordersSystem(w);
  expect(w.chopMarks).toEqual([]);
});

test('markedTrees da lo mismo que treeMarked casilla a casilla, con órdenes pendientes', () => {
  const w = world();
  const trees: Point[] = [];
  for (let i = 0; i < w.grid.tiles.length && trees.length < 4; i++)
    if (w.grid.tiles[i] === Tile.Tree)
      trees.push({ x: i % w.grid.width, y: Math.floor(i / w.grid.width) });
  const [a, b, c, d] = trees as [Point, Point, Point, Point];
  for (const t of [a, b]) issue(w, { type: 'markTree', ...t, on: true });
  ordersSystem(w);
  issue(w, { type: 'markTree', ...b, on: false });
  issue(w, { type: 'markTree', ...c, on: true });
  issue(w, { type: 'markTree', ...d, on: true });
  issue(w, { type: 'markTree', ...d, on: false });
  const set = markedTrees(w);
  for (const t of trees) expect(set.has(t.y * w.grid.width + t.x)).toBe(treeMarked(w, t.x, t.y));
  expect(set.size).toBe(2);
});

test('dónde se puede construir cada cosa', () => {
  const w = world();
  const grass = find(w, Tile.Grass);
  const road = find(w, Tile.Road);
  const floor = find(
    w,
    Tile.Floor,
    (p) => !w.storage.tiles.some((s) => s.x === p.x && s.y === p.y),
  );
  const win = find(w, Tile.Window);
  for (const kind of ['bed', 'table', 'campfire', 'woodWall', 'woodDoor'] as const) {
    expect(canPlace(w, kind, grass)).toBe(true);
    expect(canPlace(w, kind, road)).toBe(true);
    expect(canPlace(w, kind, win)).toBe(false);
  }
  expect(canPlace(w, 'board', win)).toBe(true);
  expect(canPlace(w, 'board', grass)).toBe(false);
  expect(canPlace(w, 'unboard', win)).toBe(false);
  // Ocupado: almacén, cama, contenedor, mueble, montón, otro plano, puerta.
  expect(canPlace(w, 'table', w.storage.tiles[0]!)).toBe(false);
  expect(canPlace(w, 'table', w.beds[0]!.pos)).toBe(false);
  expect(canPlace(w, 'table', w.containers[0]!.pos)).toBe(false);
  expect(canPlace(w, 'table', w.base.door)).toBe(false);
  w.furniture.push({ id: 80, kind: 'campfire', pos: { ...floor } });
  expect(canPlace(w, 'table', floor)).toBe(false);
  w.furniture = [];
  w.piles.push({
    id: 81,
    pos: { ...floor },
    items: {
      food: 0,
      bandage: 0,
      knife: 0,
      bat: 0,
      axe: 0,
      wood: 1,
      cloth: 0,
      curtains: 0,
      thread: 0,
      needle: 0,
      crowbar: 0,
      machete: 0,
      painkillers: 0,
    },
  });
  expect(canPlace(w, 'table', floor)).toBe(false);
  w.piles = [];
  w.blueprints.push({ id: 82, kind: 'bed', pos: { ...floor }, wood: 0, progress: 0 });
  expect(canPlace(w, 'table', floor)).toBe(false);
  // Sin ver, no.
  w.seen[grass.y * w.grid.width + grass.x] = 0;
  expect(canPlace(w, 'table', grass)).toBe(false);
});

test('colocar un plano y cancelarlo (la madera entregada queda en un montón)', () => {
  const w = world();
  const g = find(w, Tile.Grass);
  issue(w, { type: 'placeBlueprint', kind: 'woodWall', x: g.x, y: g.y });
  ordersSystem(w);
  expect(w.blueprints).toHaveLength(1);
  const b = w.blueprints[0]!;
  expect(b).toMatchObject({ kind: 'woodWall', pos: g, wood: 0, progress: 0 });
  // Otra vez en el mismo sitio, no.
  issue(w, { type: 'placeBlueprint', kind: 'table', x: g.x, y: g.y });
  ordersSystem(w);
  expect(w.blueprints).toHaveLength(1);
  b.wood = 2;
  w.woodLog.chopped += 2; // como si se hubiera talado y traído
  issue(w, { type: 'cancelBlueprint', id: b.id });
  ordersSystem(w);
  expect(w.blueprints).toEqual([]);
  expect(w.piles).toHaveLength(1);
  expect(w.piles[0]!.pos).toEqual(g);
  expect(w.piles[0]!.items.wood).toBe(2);
  expect(checkInvariants(w)).toEqual([]);
});

test('cancelar un plano de tapiar deja la madera en una casilla transitable de al lado', () => {
  const w = world();
  const win = find(w, Tile.Window);
  issue(w, { type: 'placeBlueprint', kind: 'board', x: win.x, y: win.y });
  ordersSystem(w);
  w.blueprints[0]!.wood = 3;
  w.woodLog.chopped += 3;
  issue(w, { type: 'cancelBlueprint', id: w.blueprints[0]!.id });
  ordersSystem(w);
  const p = w.piles[0]!;
  expect(Math.max(Math.abs(p.pos.x - win.x), Math.abs(p.pos.y - win.y))).toBe(1);
  expect(checkInvariants(w)).toEqual([]);
});

test('setWork cambia cualquier trabajo', () => {
  const w = world();
  const s = w.survivors[0]!;
  issue(w, { type: 'setWork', survivorId: s.id, work: 'build', enabled: false });
  ordersSystem(w);
  expect(s.work.build).toBe(false);
});
