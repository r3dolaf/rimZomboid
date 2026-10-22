import { expect, test } from 'vitest';
import { treeMarked } from '../sim/build';
import { setTile } from '../sim/map/grid';
import { ordersSystem } from '../sim/orders';
import { emptyWorld } from '../sim/testing/fixtures';
import { Tile, type World } from '../sim/types';
import {
  buildAt,
  buildLine,
  liveBlueprints,
  markTreesIn,
  pendingPlacements,
  toggleTree,
  wallLine,
} from './tools';

function world(): World {
  const w = emptyWorld(10, 10);
  w.seen.fill(1);
  return w;
}

test('clic con Talar: marca o desmarca un árbol visto, contando lo pendiente', () => {
  const w = world();
  setTile(w.grid, 3, 3, Tile.Tree);
  toggleTree(w, 3, 3);
  expect(treeMarked(w, 3, 3)).toBe(true);
  toggleTree(w, 3, 3);
  expect(treeMarked(w, 3, 3)).toBe(false);
  toggleTree(w, 3, 3);
  ordersSystem(w);
  expect(w.chopMarks).toEqual([3 * 10 + 3]);
  toggleTree(w, 4, 4); // hierba: nada
  setTile(w.grid, 5, 5, Tile.Tree);
  w.seen[5 * 10 + 5] = 0;
  toggleTree(w, 5, 5); // sin ver: nada
  expect(w.orders).toEqual([]);
});

test('arrastrar con Talar marca todos los árboles vistos del rectángulo (en cualquier sentido)', () => {
  const w = world();
  for (const [x, y] of [
    [1, 1],
    [2, 3],
    [4, 2],
    [6, 6],
  ] as const)
    setTile(w.grid, x, y, Tile.Tree);
  w.seen[2 * 10 + 4] = 0;
  toggleTree(w, 1, 1); // ya marcado: no se desmarca al arrastrar
  markTreesIn(w, { x: 4, y: 3 }, { x: 0, y: 0 });
  ordersSystem(w);
  expect([...w.chopMarks].sort((a, b) => a - b)).toEqual([1 * 10 + 1, 3 * 10 + 2]);
});

test('clic con Construir pone el plano elegido; en un plano, lo cancela', () => {
  const w = world();
  buildAt(w, 'campfire', 4, 4);
  expect(pendingPlacements(w)).toEqual([{ kind: 'campfire', pos: { x: 4, y: 4 } }]);
  buildAt(w, 'table', 4, 4); // ya hay uno pendiente ahí
  expect(w.orders).toHaveLength(1);
  ordersSystem(w);
  const b = w.blueprints[0]!;
  expect(b.kind).toBe('campfire');
  buildAt(w, 'table', 4, 4);
  expect(w.orders).toEqual([{ type: 'cancelBlueprint', id: b.id }]);
  expect(liveBlueprints(w)).toEqual([]); // ya no se dibuja
  buildAt(w, 'table', 4, 4); // ni se cancela dos veces ni se pone otro encima
  expect(w.orders).toHaveLength(1);
  ordersSystem(w);
  expect(w.blueprints).toEqual([]);
  buildAt(w, 'board', 2, 2); // no es una ventana
  expect(w.orders).toEqual([]);
});

test('la línea de muros sigue el eje más largo desde donde se empezó', () => {
  expect(wallLine({ x: 1, y: 1 }, { x: 4, y: 2 })).toEqual([
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ]);
  expect(wallLine({ x: 3, y: 5 }, { x: 2, y: 2 })).toEqual([
    { x: 3, y: 5 },
    { x: 3, y: 4 },
    { x: 3, y: 3 },
    { x: 3, y: 2 },
  ]);
  expect(wallLine({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([{ x: 0, y: 0 }]);
});

test('arrastrar muros pone uno por casilla válida y se salta las ocupadas', () => {
  const w = world();
  setTile(w.grid, 3, 5, Tile.Wall);
  buildLine(w, 'woodWall', { x: 1, y: 5 }, { x: 5, y: 6 });
  expect(pendingPlacements(w).map((p) => p.pos.x)).toEqual([1, 2, 4, 5]);
  ordersSystem(w);
  expect(w.blueprints.map((b) => b.pos.x)).toEqual([1, 2, 4, 5]);
  buildLine(w, 'woodWall', { x: 0, y: 5 }, { x: 2, y: 5 }); // las que ya tienen plano no se cancelan
  expect(pendingPlacements(w).map((p) => p.pos.x)).toEqual([0]);
});

test('Cortinas: en una ventana con cortinas las corre (o abre); en una sin cortinas, las cuelga (H4d)', () => {
  const w = world();
  setTile(w.grid, 2, 2, Tile.Window);
  setTile(w.grid, 5, 2, Tile.Window);
  setTile(w.grid, 7, 2, Tile.CurtainedWindow);
  w.curtains = [2 * 10 + 2, 2 * 10 + 7];
  buildAt(w, 'curtains', 2, 2);
  buildAt(w, 'curtains', 5, 2);
  buildAt(w, 'curtains', 7, 2);
  expect(w.orders).toEqual([
    { type: 'placeBlueprint', kind: 'curtains', x: 2, y: 2 },
    { type: 'placeBlueprint', kind: 'hangCurtains', x: 5, y: 2 },
    { type: 'placeBlueprint', kind: 'curtains', x: 7, y: 2 },
  ]);
  w.orders = [];
  buildAt(w, 'curtains', 4, 4); // hierba: nada
  buildAt(w, 'takeDownCurtains', 5, 2); // sin cortinas: nada que descolgar
  buildAt(w, 'smashWindow', 7, 2);
  expect(w.orders).toEqual([{ type: 'placeBlueprint', kind: 'smashWindow', x: 7, y: 2 }]);
});
