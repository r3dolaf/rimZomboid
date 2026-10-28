// @vitest-environment jsdom
// H5b §8: la ropa en pantalla.
import { expect, test } from 'vitest';
import { newGarment } from '../sim/clothes';
import { emptyInventory } from '../sim/items';
import { logEvent, type LogEntry } from '../sim/log';
import { ordersSystem } from '../sim/orders';
import { emptyWorld } from '../sim/testing/fixtures';
import { formatItems, garmentText, logText, noticeFor } from './describe';
import { createFlag } from './flag';
import { LOG_CATEGORY } from './logPanel';
import { NOTICE_GROUPS, pauses } from './noticePrefs';
import { createSelection } from './selection';
import { mountSheet } from './sheet';
import { mountStoragePanel } from './storagePanel';

const e = (x: Parameters<typeof logEvent>[1]) => ({ tick: 0, ...x }) as LogEntry;

test('registro: a quién se le rompe qué y por dónde (Combate)', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  expect(
    logText(
      e({ kind: 'clothesTorn', survivorId: s.id, garment: 'denimJacket', part: 'leftArm' }),
      w,
    ),
  ).toBe(`A ${s.name} se le ha roto la chaqueta vaquera por el brazo izquierdo`);
  expect(
    logText(e({ kind: 'clothesTorn', survivorId: s.id, garment: 'jeans', part: 'rightLeg' }), w),
  ).toBe(`A ${s.name} se le han roto los vaqueros por la pierna derecha`);
  expect(LOG_CATEGORY.clothesTorn).toBe('combat');
});

function sheetWorld() {
  const root = document.createElement('div');
  document.body.append(root);
  const w = emptyWorld(10, 10);
  const selection = createSelection();
  const sheet = mountSheet(root, { world: w, selection });
  return { root, w, selection, sheet };
}

test('estado de una prenda: agujeros, parches, refuerzos, sucia, con sangre, de un muerto', () => {
  const w = emptyWorld(5, 5);
  const g = newGarment(w, 'denimJacket');
  expect(garmentText(g)).toBe('Chaqueta vaquera');
  g.holes.push('leftArm');
  g.patches.torso = 'denim';
  g.pads.rightArm = 'leather';
  g.dirtHours = 100;
  g.bloody = true;
  g.from = 'zombie';
  expect(garmentText(g)).toBe(
    'Chaqueta vaquera (rota por el brazo izquierdo; parche de vaquero en el torso; refuerzo de cuero en el brazo derecho; sucia; con sangre; de un zombi)',
  );
});

test('pestaña Ropa: cada zona con lo que lleva y lo que protege, su atuendo (para cambiarlo), favorita y odiada', () => {
  const { root, w, selection, sheet } = sheetWorld();
  const s = w.survivors[0]!;
  s.worn.push(newGarment(w, 'denimJacket'));
  selection.set(s.id);
  (root.querySelector('[data-testid="sheet-tab-clothes"]') as HTMLButtonElement).click();
  sheet.update();
  const pane = root.querySelector('[data-testid="sheet-pane-clothes"]') as HTMLElement;
  expect(pane.hidden).toBe(false);
  const torso = pane.querySelector('[data-testid="clothes-torso"]')!;
  expect(torso.textContent).toContain('Torso');
  expect(torso.textContent).toContain('Chaqueta vaquera');
  expect(torso.textContent).toContain('Camiseta');
  expect(torso.textContent).toMatch(/Arañazos \d+ % · Mordiscos \d+ %/);
  expect(pane.querySelector('[data-testid="clothes-head"]')!.textContent).toContain('Nada');
  expect(pane.textContent).toContain('Favorita: Casco de moto');
  expect(pane.textContent).toContain('Odiada: Perneras de cuero');
  const select = pane.querySelector('[data-testid="sheet-outfit"]') as HTMLSelectElement;
  expect([...select.options].map((o) => o.textContent)).toEqual(['Cualquiera', 'Saqueo', 'Base']);
  expect(select.value).toBe('1');
  select.value = '2';
  select.dispatchEvent(new Event('change'));
  expect(w.orders).toContainEqual({ type: 'setOutfit', survivorId: s.id, outfitId: 2 });
  ordersSystem(w);
  sheet.update();
  expect(select.value).toBe('2');
  (root.querySelector('[data-testid="sheet-tab-general"]') as HTMLButtonElement).click();
  root.remove();
});

test('Almacén: Materiales y Ropa, cada prenda con su estado', () => {
  const root = document.createElement('div');
  const w = emptyWorld(5, 5);
  const panel = mountStoragePanel(root, { world: w, open: createFlag(true) });
  const g = newGarment(w, 'jeans');
  g.bloody = true;
  w.storage.items.pieces.push(g, newGarment(w, 'cap'));
  w.storage.items.denim = 2;
  panel.update();
  const el = root.querySelector('[data-testid="storage-panel"]')!;
  expect(el.textContent).toContain('Materiales');
  expect(el.textContent).toContain('Retales de vaquero');
  const clothes = root.querySelector('[data-testid="storage-clothes"]')!;
  expect([...clothes.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
    'Vaqueros (con sangre)',
    'Gorra',
  ]);
  w.storage.items.pieces = [];
  panel.update();
  expect(clothes.textContent).toContain('Nada');
});

test('aviso "Se ha cortado el agua" (amarillo, sin pausa, en el menú de Avisos); registro: Llueve y lo encontrado con prendas', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  const info = noticeFor(e({ kind: 'waterCut' }));
  expect(info).toEqual({ tone: 'mixed', title: 'Se ha cortado el agua', focusId: null });
  expect(pauses({}, 'waterCut', info!.tone)).toBe(false);
  expect(NOTICE_GROUPS.flatMap((g) => g.kinds)).toContain('waterCut');
  expect(logText(e({ kind: 'waterCut' }), w)).toBe('Se ha cortado el agua');
  expect(logText(e({ kind: 'rain' }), w)).toBe('Llueve');
  const items = { ...emptyInventory(), food: 2 };
  items.pieces.push(newGarment(w, 'cap'), newGarment(w, 'jeans'));
  expect(formatItems(items)).toBe('2 latas y 2 prendas');
  expect(
    logText(e({ kind: 'crafted', survivorId: s.id, recipe: 'mend', garment: 'jeans' }), w),
  ).toBe(`${s.name} ha remendado los vaqueros`);
});
