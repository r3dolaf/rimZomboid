// H4d §5: prioridades de trabajo (1–4) por colono.
import { expect, test } from 'vitest';
import { BUILD } from './balance';
import { issue, ordersSystem } from './orders';
import { setTile } from './map/grid';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Action, type World } from './types';
import { findWork } from './work';

/** Ana con un plano listo para construir y un árbol marcado, con el hacha en la mano. */
function world(): World {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  s.equipped = 'axe';
  w.blueprints.push({
    id: 90,
    kind: 'table',
    pos: { x: 2, y: 2 },
    wood: BUILD.table.wood,
    progress: 0,
  });
  w.common.woodLog.chopped += BUILD.table.wood;
  setTile(w.grid, 9, 9, Tile.Tree);
  w.chopMarks = [9 * 12 + 9];
  w.storage.items.food = 50; // sin hambre
  return w;
}

const what = (a: Action | null) => (a?.type === 'moveTo' ? a.then?.type : a?.type);

test('todo a 3: el orden de siempre (construir antes que talar)', () => {
  const w = world();
  expect(what(findWork(w.survivors[0]!, w))).toBe('build');
});

test('con un número más bajo, va antes: talar a 1 pasa delante de construir a 3', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.priorities.chop = 1;
  expect(what(findWork(s, w))).toBe('chop');
  s.priorities.chop = 3;
  s.priorities.build = 4;
  expect(what(findWork(s, w))).toBe('chop');
});

test('sin permiso no lo hace, aunque tenga prioridad 1', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.priorities.chop = 1;
  s.work.chop = false;
  expect(what(findWork(s, w))).not.toBe('chop'); // (devuelve el hacha: no puede talar)
});

test('con poca comida, saquear sigue yendo delante de todo', () => {
  const w = world();
  const s = w.survivors[0]!;
  w.storage.items.food = 0;
  w.containers = [
    {
      id: 7,
      houseId: 1,
      pos: { x: 6, y: 9 },
      kind: 'fridge',
      items: { ...w.storage.items, food: 5 },
      searched: false,
      designated: true,
      reservedBy: null,
    },
  ];
  s.priorities.loot = 4;
  s.priorities.build = 1;
  expect(what(findWork(s, w))).toBe('search');
});

test('orden de cambiar la prioridad (solo de 1 a 4)', () => {
  const w = world();
  const s = w.survivors[0]!;
  issue(w, { type: 'setPriority', survivorId: s.id, work: 'chop', priority: 1 });
  issue(w, { type: 'setPriority', survivorId: s.id, work: 'build', priority: 9 });
  ordersSystem(w);
  expect(s.priorities.chop).toBe(1);
  expect(s.priorities.build).toBe(3);
});
