// @vitest-environment jsdom
// H5b2 §7: las bolsas en pantalla (ficha, registro).
import { expect, test } from 'vitest';
import { newBag } from '../sim/bags';
import { newGarment } from '../sim/clothes';
import type { LogEntry } from '../sim/log';
import { ordersSystem } from '../sim/orders';
import { emptyWorld } from '../sim/testing/fixtures';
import { bagsView, logText, pileLabel } from './describe';
import { emptyInventory } from '../sim/items';
import { mountCraftPanel } from './craftPanel';
import { createFlag } from './flag';
import { mountOutfitsPanel } from './outfitsPanel';
import { mountStoragePanel } from './storagePanel';
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

test('Almacén: sección Bolsas con lo de dentro y su lista, que se edita ahí', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const w = emptyWorld(10, 10);
  const b = newBag(w, 'hikingPack');
  b.items.food = 3;
  b.list = { food: 3 };
  w.storage.items.pieces.push(b);
  const panel = mountStoragePanel(root, { world: w, open: createFlag(true) });
  panel.update();
  const bags = root.querySelector('[data-testid="storage-bags"]') as HTMLElement;
  expect(bags.textContent).toContain('Mochila de excursión');
  expect(bags.textContent).toContain('3 latas');
  (bags.querySelector(`[data-testid="bag-${b.id}-plus-food"]`) as HTMLButtonElement).click();
  ordersSystem(w);
  expect(b.list).toEqual({ food: 4 });
  root.remove();
});

test('Atuendos: una casilla por bolsa y «Bolsa en la mano»', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const w = emptyWorld(10, 10);
  const panel = mountOutfitsPanel(root, { world: w, open: createFlag(true) });
  panel.update();
  const duffel = root.querySelector('[data-testid="outfit-bag-duffel"]') as HTMLInputElement;
  const hand = root.querySelector('[data-testid="outfit-handbag"]') as HTMLInputElement;
  expect(duffel.checked).toBe(true);
  expect(hand.checked).toBe(true);
  duffel.click();
  hand.click();
  ordersSystem(w);
  expect(w.outfits[0]!.bags).not.toContain('duffel');
  expect(w.outfits[0]!.handBag).toBe(false);
  panel.update();
  expect(duffel.checked).toBe(false);
  root.remove();
});

test('Fabricar: la bolsa de tela; mapa: una bolsa en el suelo dice qué es y cuántas cosas lleva', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const w = emptyWorld(10, 10);
  mountCraftPanel(root, { world: w, open: createFlag(true) }).update();
  const add = root.querySelector('[data-testid="craft-add-sewBag"]') as HTMLButtonElement;
  expect(add.textContent).toBe('+ Bolsa de tela');
  const b = newBag(w, 'schoolBag');
  b.items.food = 3;
  b.items.pieces.push(newGarment(w, 'cap'));
  const pile = { id: 1, pos: { x: 1, y: 1 }, items: { ...emptyInventory(), pieces: [b] } };
  expect(pileLabel(pile)).toBe('Mochila escolar (4 cosas)');
  b.items.food = 0;
  b.items.pieces = [];
  expect(pileLabel(pile)).toBe('Mochila escolar (vacía)');
  expect(pileLabel({ ...pile, items: { ...emptyInventory(), wood: 2 } })).toBeNull();
  root.remove();
});

test('revisión: un hueco fijado y vacío enseña «Fijada» para poder soltarlo', () => {
  const { root, w, s, sheet } = sheetWorld();
  s.bagsPinned = ['hand'];
  sheet.update();
  const pin = root.querySelector('[data-testid="bag-pin-hand"]') as HTMLButtonElement;
  expect(pin.textContent).toBe('Fijada');
  pin.click();
  ordersSystem(w);
  expect(s.bagsPinned).toEqual([]);
  root.remove();
});
