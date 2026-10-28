// @vitest-environment jsdom
// H5b §8: la ropa en pantalla.
import { expect, test } from 'vitest';
import { newGarment } from '../sim/clothes';
import { emptyInventory } from '../sim/items';
import { logEvent, type LogEntry } from '../sim/log';
import { ordersSystem } from '../sim/orders';
import { emptyWorld } from '../sim/testing/fixtures';
import { effectiveBills as effectiveBillsOf } from '../sim/orders';
import { mountBuildMenu } from './buildMenu';
import { mountCraftPanel } from './craftPanel';
import { formatItems, furnitureLabel, garmentText, logText, noticeFor } from './describe';
import { createTimeController } from '../game/timeController';
import { createFlag } from './flag';
import { mountHud } from './hud';
import { LOG_CATEGORY } from './logPanel';
import { NOTICE_GROUPS, pauses } from './noticePrefs';
import { createSelection } from './selection';
import { mountSheet } from './sheet';
import { mountOutfitsPanel } from './outfitsPanel';
import { mountStoragePanel } from './storagePanel';
import { createTool } from './tool';
import { mountWorkPanel } from './workPanel';

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

// Tarea 15: atuendos, trabajos, fabricar, construir y mapa.
test('panel Atuendos: los de serie, casillas por prenda agrupadas por zona, ropa de muertos; crear, renombrar y borrar', () => {
  const root = document.createElement('div');
  const w = emptyWorld(5, 5);
  const panel = mountOutfitsPanel(root, { world: w, open: createFlag(true) });
  panel.update();
  const el = root.querySelector('[data-testid="outfits-panel"]') as HTMLElement;
  expect(el.hidden).toBe(false);
  const tabs = () =>
    [...root.querySelectorAll('[data-testid^="outfit-tab-"]')].map((b) => b.textContent);
  expect(tabs()).toEqual(['Cualquiera', 'Saqueo', 'Base']);
  expect([...el.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
    'Cabeza',
    'Torso y brazos',
    'Piernas',
  ]);
  const box = (k: string) =>
    root.querySelector(`[data-testid="outfit-garment-${k}"]`) as HTMLInputElement;
  expect(box('helmet').checked).toBe(true);
  expect((root.querySelector('[data-testid="outfit-dead"]') as HTMLInputElement).checked).toBe(
    true,
  );
  // Base: sin casco.
  (root.querySelector('[data-testid="outfit-tab-3"]') as HTMLButtonElement).click();
  panel.update();
  expect(box('helmet').checked).toBe(false);
  box('helmet').checked = true;
  box('helmet').dispatchEvent(new Event('change'));
  expect(w.orders).toContainEqual({
    type: 'setOutfitGarment',
    outfitId: 3,
    garment: 'helmet',
    on: true,
  });
  const name = root.querySelector('[data-testid="outfit-name"]') as HTMLInputElement;
  name.value = 'Casa';
  name.dispatchEvent(new Event('change'));
  expect(w.orders).toContainEqual({ type: 'renameOutfit', outfitId: 3, name: 'Casa' });
  (root.querySelector('[data-testid="outfit-add"]') as HTMLButtonElement).click();
  panel.update(); // en pausa: ya se ve
  expect(tabs()).toEqual(['Cualquiera', 'Saqueo', 'Casa', 'Atuendo 4']);
  ordersSystem(w);
  (root.querySelector('[data-testid="outfit-delete"]') as HTMLButtonElement).click();
  ordersSystem(w);
  panel.update();
  expect(tabs()).toEqual(['Cualquiera', 'Saqueo', 'Casa']);
});

test('Trabajos: columna Atuendo para cambiar el de cada colono', () => {
  const root = document.createElement('div');
  const w = emptyWorld(5, 5);
  const panel = mountWorkPanel(root, { world: w, open: createFlag(true) });
  panel.update();
  const s = w.survivors[0]!;
  expect(root.querySelector('th:last-child')!.textContent).toBe('Atuendo');
  const select = root.querySelector(`[data-testid="work-${s.id}-outfit"]`) as HTMLSelectElement;
  expect(select.value).toBe('1');
  select.value = '3';
  select.dispatchEvent(new Event('change'));
  expect(w.orders).toContainEqual({ type: 'setOutfit', survivorId: s.id, outfitId: 3 });
  panel.update();
  expect(select.value).toBe('3');
});

test('Fabricar: Remendar, Reforzar, Descoser ropa y Lavar ropa, con "siempre que haya" (sin N); aviso si no hay barreño', () => {
  const root = document.createElement('div');
  const w = emptyWorld(5, 5);
  const panel = mountCraftPanel(root, { world: w, open: createFlag(true) });
  panel.update();
  for (const r of ['mend', 'pad', 'unpickGarment', 'wash'])
    expect(root.querySelector(`[data-testid="craft-add-${r}"]`)).not.toBeNull();
  expect(root.querySelector('[data-testid="craft-stock"]')!.textContent).toContain('retales');
  (root.querySelector('[data-testid="craft-add-wash"]') as HTMLButtonElement).click();
  panel.update();
  const bill = effectiveBillsOf(w)[0]!;
  const mode = root.querySelector(`[data-testid="bill-${bill.id}-mode"]`) as HTMLSelectElement;
  expect([...mode.options].map((o) => o.textContent)).toEqual(['siempre que haya', 'veces']);
  expect(mode.value).toBe('always');
  expect((root.querySelector(`[data-testid="bill-${bill.id}-target"]`) as HTMLElement).hidden).toBe(
    true,
  );
  const noTub = root.querySelector('[data-testid="craft-no-tub"]') as HTMLElement;
  expect(noTub.hidden).toBe(false);
  expect(noTub.textContent).toBe('Hace falta un barreño');
  w.furniture.push({ id: 90, kind: 'tub', pos: { x: 1, y: 1 }, water: 0 });
  panel.update();
  expect(noTub.hidden).toBe(true);
});

test('Construir: el barreño (4 tablas); en el mapa, su agua y la de las cisternas al pasar el ratón', () => {
  const root = document.createElement('div');
  mountBuildMenu(root, { tool: createTool() });
  expect(root.querySelector('[data-testid="build-tub"]')!.textContent).toBe('Barreño · 4');
  const w = emptyWorld(5, 5);
  expect(furnitureLabel(w, { id: 1, kind: 'tub', pos: { x: 0, y: 0 }, water: 12 })).toBe(
    'Barreño: 12 / 20 litros',
  );
  expect(furnitureLabel(w, { id: 2, kind: 'cistern', pos: { x: 0, y: 0 }, water: 150 })).toBe(
    'Cisterna: 150 / 200 litros',
  );
  expect(furnitureLabel(w, { id: 3, kind: 'sink', pos: { x: 0, y: 0 } })).toBe(
    'Fregadero (con agua corriente)',
  );
  w.waterCutAt = 0;
  expect(furnitureLabel(w, { id: 3, kind: 'sink', pos: { x: 0, y: 0 } })).toBe(
    'Fregadero (sin agua)',
  );
  expect(furnitureLabel(w, { id: 4, kind: 'table', pos: { x: 0, y: 0 } })).toBeNull();
});

test('arriba, el botón Atuendos', () => {
  const root = document.createElement('div');
  let opened = 0;
  mountHud(root, {
    seed: 1,
    time: createTimeController(),
    tool: createTool(),
    narrator: 'balanced',
    toggleOutfits: () => opened++,
  });
  const b = root.querySelector('[data-testid="hud-outfits"]') as HTMLButtonElement;
  expect(b.hidden).toBe(false);
  expect(b.textContent).toBe('Atuendos');
  b.click();
  expect(opened).toBe(1);
});
