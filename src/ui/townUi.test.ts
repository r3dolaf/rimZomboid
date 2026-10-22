// @vitest-environment jsdom
// H4f §6: los edificios por su nombre — ficha, registro y lo que hace cada colono.
import { expect, test } from 'vitest';
import { emptyInventory } from '../sim/items';
import { logEvent } from '../sim/log';
import { emptyWorld } from '../sim/testing/fixtures';
import type { BuildingKind, World } from '../sim/types';
import { activityText, buildingThe, buildingTitle, formatLogEntry } from './describe';
import { mountHousePanel } from './housePanel';
import { createSelection } from './selection';

/** Un pueblo de mentira: tres casas, un supermercado, dos granjas y una tienda de ropa. */
function town(): World {
  const w = emptyWorld(60, 10);
  const kinds: BuildingKind[] = [
    'house',
    'supermarket',
    'farm',
    'house',
    'clothes',
    'farm',
    'house',
  ];
  w.houses = kinds.map((kind, i) => ({
    id: i + 1,
    kind,
    rect: { x: i * 8, y: 1, w: 6, h: 6 },
    door: { x: i * 8 + 3, y: 6 },
  }));
  w.containers = w.houses.map((h) => ({
    id: h.id,
    houseId: h.id,
    pos: { x: h.rect.x + 2, y: 3 },
    kind: 'shelf',
    items: emptyInventory(),
    searched: false,
    designated: false,
    reservedBy: null,
  }));
  return w;
}

test('nombre de cada edificio: los que hay uno solo, sin número; los demás, numerados por tipo', () => {
  const w = town();
  expect(w.houses.map((h) => buildingTitle(w, h.id))).toEqual([
    'Casa 1',
    'Supermercado',
    'Granja 1',
    'Casa 2',
    'Tienda de ropa',
    'Granja 2',
    'Casa 3',
  ]);
  expect(w.houses.map((h) => buildingThe(w, h.id))).toEqual([
    'la casa 1',
    'el supermercado',
    'la granja 1',
    'la casa 2',
    'la tienda de ropa',
    'la granja 2',
    'la casa 3',
  ]);
});

test('el registro dice el nombre del edificio', () => {
  const w = town();
  w.tick = 0;
  const s = w.survivors[0]!;
  const text = () => formatLogEntry(w.log.at(-1)!, w).replace(/^.* · /, '');
  logEvent(w, {
    kind: 'found',
    survivorId: s.id,
    houseId: 2,
    items: { ...emptyInventory(), food: 6 },
  });
  expect(text()).toBe(`${s.name} ha encontrado 6 latas en el supermercado`);
  logEvent(w, { kind: 'emptyContainer', survivorId: s.id, houseId: 4 });
  expect(text()).toBe(`${s.name} no encuentra nada en la casa 2`);
  logEvent(w, { kind: 'houseEmptied', houseId: 5 });
  expect(text()).toBe('Se ha vaciado la tienda de ropa');
  logEvent(w, { kind: 'forced', survivorId: s.id, houseId: 6 });
  expect(text()).toBe(`${s.name} ha forzado la puerta de la granja 2`);
  logEvent(w, { kind: 'cache', survivorId: s.id, houseId: 1, cans: 3 });
  expect(text()).toBe(`${s.name} recuerda una despensa en la casa 1: 3 latas`);
});

test('"Va a saquear el supermercado"', () => {
  const w = town();
  const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 10, y: 3 }, then: { type: 'search', containerId: 2 } };
  expect(activityText(s, w)).toBe('Va a saquear el supermercado');
});

test('la ficha del edificio se titula con su nombre', () => {
  const root = document.createElement('div');
  const w = town();
  const sel = createSelection();
  const panel = mountHousePanel(root, { world: w, selection: sel });
  sel.set(3);
  panel.update();
  expect(root.querySelector('[data-testid="house-panel"] h2')!.textContent).toBe('Granja 1');
});

test('"Se va a saquear" vale para cualquier edificio (no "Marcada" en el supermercado)', () => {
  const root = document.createElement('div');
  const w = town();
  w.containers.find((c) => c.houseId === 2)!.designated = true;
  const sel = createSelection();
  const panel = mountHousePanel(root, { world: w, selection: sel });
  sel.set(2);
  panel.update();
  const text = root.querySelector('[data-testid="house-panel"]')!.textContent!;
  expect(text).toContain('Supermercado');
  expect(text).toContain('Se va a saquear');
  expect(text).not.toMatch(/Marcada/);
});
