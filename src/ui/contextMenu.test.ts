// @vitest-environment jsdom
// H5c1 §8: el menú del clic derecho: en una ventana, una puerta, un muro dañado o un plano, solo lo
// que tiene sentido allí, con lo que gasta y lo que tienes.
import { expect, test } from 'vitest';
import { damageTile } from '../sim/structures';
import { setTile } from '../sim/map/grid';
import { emptyWorld } from '../sim/testing/fixtures';
import { createTool } from './tool';
import { Tile, type World } from '../sim/types';
import { mountBuildMenu } from './buildMenu';
import { contextOptions, mountContextMenu } from './contextMenu';

function world(): World {
  const w = emptyWorld(10, 10);
  w.seen.fill(1);
  w.storage.items.wood = 5;
  w.storage.items.curtains = 2;
  return w;
}

const labels = (w: World, x: number, y: number) => contextOptions(w, { x, y }).map((o) => o.label);

test('una ventana: tapiar, cortinas (colgar, correr o abrir, descolgar) y romper', () => {
  const w = world();
  setTile(w.grid, 2, 2, Tile.Window);
  expect(labels(w, 2, 2)).toEqual([
    'Tapiar — 3 tablas (tienes 5)',
    'Colgar cortinas — 1 juego de cortinas (tienes 2)',
    'Romper ventana',
  ]);
  w.curtains.push(2 * w.grid.width + 2); // con cortinas, abiertas
  expect(labels(w, 2, 2)).toEqual([
    'Tapiar — 3 tablas (tienes 5)',
    'Correr cortinas',
    'Descolgar cortinas',
    'Romper ventana',
  ]);
  setTile(w.grid, 2, 2, Tile.CurtainedWindow); // corridas
  expect(labels(w, 2, 2)).toContain('Abrir cortinas');
  setTile(w.grid, 2, 2, Tile.BoardedWindow);
  expect(labels(w, 2, 2)).toEqual(['Quitar tablas']);
  damageTile(w, 2, 2, 3);
  expect(labels(w, 2, 2)).toEqual(['Quitar tablas', 'Reparar — 1 tabla (tienes 5)']);
  setTile(w.grid, 3, 2, Tile.BrokenWindow);
  expect(labels(w, 3, 2)).toEqual(['Tapiar — 3 tablas (tienes 5)']);
});

test('una puerta dañada o rota, un muro dañado; lo que está bien o no se ha visto, nada', () => {
  const w = world();
  setTile(w.grid, 1, 1, Tile.Door);
  expect(labels(w, 1, 1)).toEqual([]);
  damageTile(w, 1, 1, 4);
  expect(labels(w, 1, 1)).toEqual(['Reparar — 1 tabla (tienes 5)']);
  setTile(w.grid, 2, 1, Tile.BrokenDoor);
  expect(labels(w, 2, 1)).toEqual(['Arreglar puerta — 2 tablas (tienes 5)']);
  setTile(w.grid, 3, 1, Tile.Wall);
  expect(labels(w, 3, 1)).toEqual([]);
  damageTile(w, 3, 1, 4);
  expect(labels(w, 3, 1)).toEqual(['Reparar — 1 tabla (tienes 5)']);
  setTile(w.grid, 4, 1, Tile.Window);
  w.seen[1 * w.grid.width + 4] = 0;
  expect(labels(w, 4, 1)).toEqual([]);
  expect(labels(w, 5, 5)).toEqual([]); // suelo
});

test('un plano: solo cancelarlo (y lo pedido en pausa ya cuenta)', () => {
  const w = world();
  setTile(w.grid, 2, 2, Tile.Window);
  w.blueprints.push({ id: 70, kind: 'board', pos: { x: 2, y: 2 }, wood: 0, progress: 0 });
  const opts = contextOptions(w, { x: 2, y: 2 });
  expect(opts.map((o) => o.label)).toEqual(['Cancelar plano']);
  opts[0]!.choose();
  expect(w.orders).toEqual([{ type: 'cancelBlueprint', id: 70 }]);
  expect(contextOptions(w, { x: 2, y: 2 })).toEqual([]); // ya pedido
  setTile(w.grid, 3, 2, Tile.Window);
  contextOptions(w, { x: 3, y: 2 })[0]!.choose(); // tapiar
  expect(w.orders.at(-1)).toEqual({ type: 'placeBlueprint', kind: 'board', x: 3, y: 2 });
  expect(contextOptions(w, { x: 3, y: 2 })).toEqual([]); // ya pedido en pausa
});

test('el menú se abre donde se pulsa, da la orden y se cierra; con Esc o un clic fuera, también', () => {
  const w = world();
  setTile(w.grid, 2, 2, Tile.Window);
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const menu = mountContextMenu(root, { world: w });
  const el = () => root.querySelector('[data-testid="context-menu"]') as HTMLElement;
  expect(el().hidden).toBe(true);
  expect(menu.open({ x: 5, y: 5 }, { x: 120, y: 80 })).toBe(false); // en el suelo, nada
  expect(el().hidden).toBe(true);
  expect(menu.open({ x: 2, y: 2 }, { x: 120, y: 80 })).toBe(true);
  expect(el().hidden).toBe(false);
  expect(el().style.left).toBe('120px');
  (root.querySelector('[data-testid="ctx-board"]') as HTMLButtonElement).click();
  expect(w.orders).toContainEqual({ type: 'placeBlueprint', kind: 'board', x: 2, y: 2 });
  expect(el().hidden).toBe(true);
  setTile(w.grid, 4, 4, Tile.Window);
  menu.open({ x: 4, y: 4 }, { x: 10, y: 10 });
  expect(menu.close()).toBe(true); // Esc
  expect(menu.close()).toBe(false); // ya cerrado
  menu.open({ x: 4, y: 4 }, { x: 10, y: 10 });
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  expect(el().hidden).toBe(true);
});

test('las opciones de ventana ya no están en Construir', () => {
  const root = document.createElement('div');
  const tool = createTool();
  const menu = mountBuildMenu(root, { tool, world: world() });
  tool.toggle('build');
  menu.update();
  for (const k of ['board', 'unboard', 'curtains', 'takeDownCurtains', 'smashWindow'])
    expect(root.querySelector(`[data-testid="build-${k}"]`)).toBeNull();
  expect(root.querySelectorAll('.build-group')).toHaveLength(3);
});
