// @vitest-environment jsdom
// H5b2 §7: las bolsas en pantalla (ficha, registro).
import { expect, test } from 'vitest';
import { newBag } from '../sim/bags';
import { newGarment } from '../sim/clothes';
import type { LogEntry } from '../sim/log';
import { ordersSystem } from '../sim/orders';
import { emptyWorld } from '../sim/testing/fixtures';
import { bagsView, logText } from './describe';
import { LOG_CATEGORY } from './logPanel';
import { createSelection } from './selection';
import { mountSheet } from './sheet';

function sheetWorld() {
  const root = document.createElement('div');
  document.body.append(root);
  const w = emptyWorld(10, 10);
  const selection = createSelection();
  const sheet = mountSheet(root, { world: w, selection });
  const s = w.survivors[0]!;
  selection.set(s.id);
  return { root, w, s, sheet };
}

test('vista de las bolsas: cada hueco con su bolsa, kilos, lo de dentro y su lista; manos y «Llevar siempre»', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  const b = newBag(w, 'schoolBag');
  b.items.food = 4; // 2 kg
  b.items.pieces.push(newGarment(w, 'cap'));
  b.list = { food: 2 };
  s.bags.back = b;
  s.bagsPinned = ['back'];
  s.carrying.bandage = 2;
  const v = bagsView(w, s);
  expect(v.slots.map((x) => x.name)).toEqual(['Cintura', 'Espalda', 'Mano']);
  expect(v.slots[0]!.bag).toBeNull();
  expect(v.slots[1]!.bag).toEqual({
    id: b.id,
    name: 'Mochila escolar',
    load: '2,1 / 6 kg',
    pinned: true,
    contents: '4 latas y 1 prenda',
    list: [{ item: 'food', n: 2, name: 'latas' }],
  });
  expect(v.hands).toBe('En las manos: 2 vendas · 0,2 kg');
  expect(v.keep).toEqual([{ item: 'bandage', n: 2, name: 'vendas' }]);
});

test('pestaña Bolsas: fijar, cambiar la lista con + y −, añadir y «Llevar siempre»', () => {
  const { root, w, s, sheet } = sheetWorld();
  const b = newBag(w, 'duffel');
  s.bags.hand = b;
  sheet.update();
  (root.querySelector('[data-testid="sheet-tab-bags"]') as HTMLButtonElement).click();
  const pane = root.querySelector('[data-testid="sheet-pane-bags"]') as HTMLElement;
  expect(pane.hidden).toBe(false);
  expect(pane.querySelector('[data-testid="bags-hand"]')!.textContent).toContain(
    'Bolsa de deporte',
  );
  (pane.querySelector('[data-testid="bag-pin-hand"]') as HTMLButtonElement).click();
  const add = pane.querySelector(`[data-testid="bag-${b.id}-add"]`) as HTMLSelectElement;
  add.value = 'food';
  add.dispatchEvent(new Event('change', { bubbles: true }));
  sheet.update();
  (pane.querySelector(`[data-testid="bag-${b.id}-plus-food"]`) as HTMLButtonElement).click();
  sheet.update();
  expect(pane.querySelector(`[data-testid="bag-${b.id}-list"]`)!.textContent).toContain('2 latas');
  (pane.querySelector('[data-testid="keep-plus-bandage"]') as HTMLButtonElement).click();
  (pane.querySelector('[data-testid="keep-minus-bandage"]') as HTMLButtonElement).click();
  (pane.querySelector('[data-testid="keep-minus-bandage"]') as HTMLButtonElement).click();
  sheet.update();
  ordersSystem(w);
  expect(s.bagsPinned).toEqual(['hand']);
  expect(b.list).toEqual({ food: 2 });
  expect(s.keep).toEqual({ bandage: 1 });
  root.remove();
});

test('registro: encontrar, soltar y recoger una bolsa', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  const e = (x: object) => ({ tick: 0, ...x }) as LogEntry;
  expect(logText(e({ kind: 'bagFound', survivorId: s.id, bag: 'hikingPack' }), w)).toBe(
    `${s.name} ha encontrado una mochila de excursión y se la ha puesto`,
  );
  expect(logText(e({ kind: 'bagDropped', survivorId: s.id, bag: 'duffel' }), w)).toBe(
    `${s.name} ha soltado la bolsa de deporte`,
  );
  expect(logText(e({ kind: 'bagRecovered', survivorId: s.id, bag: 'duffel' }), w)).toBe(
    `${s.name} ha recogido su bolsa de deporte`,
  );
  expect([LOG_CATEGORY.bagFound, LOG_CATEGORY.bagDropped]).toEqual(['loot', 'combat']);
});
