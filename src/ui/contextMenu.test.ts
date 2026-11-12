// @vitest-environment jsdom
// H5c1 §8: el menú del clic derecho: en una ventana, una puerta, un muro dañado o un plano, solo lo
// que tiene sentido allí, con lo que gasta y lo que tienes.
import { expect, test, vi } from 'vitest';
import { emptyInventory } from '../sim/items';
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
  // Pulsar fuera lo cierra, con el ratón o con el dedo (M1).
  for (const pointerType of ['mouse', 'touch']) {
    menu.open({ x: 4, y: 4 }, { x: 10, y: 10 });
    document.body.dispatchEvent(new PointerEvent('pointerdown', { pointerType, bubbles: true }));
    expect(el().hidden).toBe(true);
  }
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

// U1 §7: el clic derecho (mantener pulsado) en todo: saquear, talar, ver la casa y fabricar.
function town(): World {
  const w = world();
  w.houses.push({ id: 4, kind: 'house', rect: { x: 5, y: 5, w: 4, h: 4 }, door: { x: 6, y: 8 } });
  w.containers.push({
    id: 9,
    houseId: 4,
    pos: { x: 6, y: 6 },
    kind: 'fridge',
    items: emptyInventory(),
    searched: false,
    designated: false,
    reservedBy: null,
  });
  return w;
}
const kinds = (w: World, x: number, y: number, acts = {}) =>
  contextOptions(w, { x, y }, acts).map((o) => o.kind);

test('U1 §7: un mueble: saquearlo y dejar de saquearlo; también la casa entera', () => {
  const w = town();
  expect(labels(w, 6, 6)).toEqual(['🎒 Saquear la nevera', '🎒 Saquear la casa']);
  contextOptions(w, { x: 6, y: 6 })[0]!.choose();
  expect(w.orders).toEqual([{ type: 'designateContainer', containerId: 9, on: true }]);
  // Lo pedido en pausa ya cuenta.
  expect(labels(w, 6, 6)).toEqual(['🎒 Dejar de saquear la nevera', '🎒 Dejar de saquear la casa']);
  contextOptions(w, { x: 6, y: 6 })[1]!.choose();
  expect(w.orders.at(-1)).toEqual({ type: 'designateHouse', houseId: 4, on: false });
});

test('U1 §7: una casa sin ver por dentro se puede marcar; ver su ficha, solo vista', () => {
  const w = town();
  const onHouse = vi.fn();
  w.seen[7 * w.grid.width + 7] = 0;
  expect(kinds(w, 7, 7, { onHouse })).toEqual(['lootHouse']);
  expect(kinds(w, 7, 6, { onHouse })).toEqual(['lootHouse', 'viewHouse']);
  const view = contextOptions(w, { x: 7, y: 6 }, { onHouse }).find((o) => o.kind === 'viewHouse')!;
  expect(view.label).toBe('🏠 Ver la casa');
  view.choose();
  expect(onHouse).toHaveBeenCalledWith(4);
  // Ya saqueada del todo, no se ofrece saquearla.
  w.containers[0]!.searched = true;
  expect(kinds(w, 7, 6, { onHouse })).toEqual(['viewHouse']);
});

test('U1 §7: un cuerpo se registra; un árbol se tala; la mesa abre Fabricar', () => {
  const w = world();
  w.containers.push({
    id: 3,
    houseId: -1,
    pos: { x: 1, y: 1 },
    kind: 'corpse',
    items: emptyInventory(),
    searched: false,
    designated: false,
    reservedBy: null,
  });
  expect(labels(w, 1, 1)).toEqual(['🎒 Registrar el cuerpo']);
  contextOptions(w, { x: 1, y: 1 })[0]!.choose();
  expect(labels(w, 1, 1)).toEqual(['🎒 No registrar el cuerpo']);
  setTile(w.grid, 3, 3, Tile.Tree);
  expect(labels(w, 3, 3)).toEqual(['🪓 Talar el árbol']);
  contextOptions(w, { x: 3, y: 3 })[0]!.choose();
  expect(w.orders.at(-1)).toEqual({ type: 'markTree', x: 3, y: 3, on: true });
  w.furniture.push({ id: 1, kind: 'table', pos: { x: 4, y: 4 } });
  const onCraft = vi.fn();
  expect(kinds(w, 4, 4, { onCraft })).toEqual(['craft']);
  expect(kinds(w, 4, 4)).toEqual([]); // sin Fabricar (en un test), nada
  contextOptions(w, { x: 4, y: 4 }, { onCraft })[0]!.choose();
  expect(onCraft).toHaveBeenCalledTimes(1);
});

test('U1 §7: el menú en pantalla pasa Fabricar y Ver la casa', () => {
  const w = town();
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const onHouse = vi.fn();
  const menu = mountContextMenu(root, { world: w, onHouse });
  expect(menu.open({ x: 7, y: 7 }, { x: 10, y: 10 })).toBe(true);
  (root.querySelector('[data-testid="ctx-viewHouse"]') as HTMLButtonElement).click();
  expect(onHouse).toHaveBeenCalledWith(4);
});

test('C1: en la radio, encenderla o apagarla (y lo pedido en pausa ya cuenta)', () => {
  const w = world();
  w.furniture.push({ id: 70, kind: 'radio', pos: { x: 4, y: 4 }, fuel: 0, on: true });
  expect(labels(w, 4, 4)).toEqual(['📻 Apagar la radio']);
  contextOptions(w, { x: 4, y: 4 })[0]!.choose();
  expect(labels(w, 4, 4)).toEqual(['📻 Encender la radio']);
  expect(labels(w, 5, 4)).toEqual([]);
});

test('E1: en el generador, encenderlo o apagarlo (y lo pedido en pausa ya cuenta)', () => {
  const w = world();
  w.furniture.push({ id: 71, kind: 'generator', pos: { x: 4, y: 4 }, fuel: 6, on: true });
  expect(labels(w, 4, 4)).toEqual(['⚡ Apagar el generador']);
  contextOptions(w, { x: 4, y: 4 })[0]!.choose();
  expect(labels(w, 4, 4)).toEqual(['⚡ Encender el generador']);
});
