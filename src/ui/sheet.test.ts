// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { addMemory } from '../sim/mood';
import { createWorld } from '../sim/world';
import { createSelection } from './selection';
import { mountSheet } from './sheet';

function setup() {
  const root = document.createElement('div');
  document.body.append(root);
  const world = createWorld(5);
  const selection = createSelection();
  const sheet = mountSheet(root, { world, selection });
  return { root, world, selection, sheet };
}

const sheetEl = (root: HTMLElement) => root.querySelector('[data-testid="sheet"]') as HTMLElement;

test('oculta sin selección; al seleccionar muestra nombre, actividad y rasgos', () => {
  const { root, world, selection, sheet } = setup();
  sheet.update();
  expect(sheetEl(root).hidden).toBe(true);
  const s = world.survivors[0]!;
  s.traits = ['glutton'];
  selection.set(s.id);
  sheet.update();
  expect(sheetEl(root).hidden).toBe(false);
  const text = sheetEl(root).textContent!;
  expect(text).toContain(s.name);
  expect(text).toContain('Paseando');
  expect(text).toContain('Glotón');
  root.remove();
});

test('lista los motivos del ánimo con su valor y el ánimo actual → objetivo', () => {
  const { root, world, selection, sheet } = setup();
  const s = world.survivors[0]!;
  s.traits = [];
  s.needs.hunger = 20;
  s.needs.sleep = 80;
  s.needs.mood = 52;
  addMemory(s, 'ate', 0);
  selection.set(s.id);
  sheet.update();
  const items = [...sheetEl(root).querySelectorAll('[data-testid="modifier"]')].map(
    (li) => li.textContent,
  );
  expect(items).toEqual(['Hambriento −10', 'Comió +5 (quedan 6 h)']);
  expect(sheetEl(root).querySelector('[data-testid="mood"]')!.textContent).toBe('52 → 45');
  root.remove();
});

test('se actualiza cuando cambian los datos', () => {
  const { root, world, selection, sheet } = setup();
  const s = world.survivors[0]!;
  selection.set(s.id);
  sheet.update();
  s.action = { type: 'sleep', inBed: true };
  sheet.update();
  expect(sheetEl(root).textContent).toContain('Durmiendo en su cama');
  root.remove();
});

test('la ✕ cierra la ficha (Esc: ver escape.test.ts)', () => {
  const { root, world, selection, sheet } = setup();
  selection.set(world.survivors[0]!.id);
  sheet.update();
  (root.querySelector('[data-testid="sheet-close"]') as HTMLElement).click();
  expect(selection.id).toBeNull();
  root.remove();
});

test('la ✕ no se reconstruye al cambiar los datos (si no, un clic puede perderse)', () => {
  const { root, world, selection, sheet } = setup();
  const s = world.survivors[0]!;
  selection.set(s.id);
  sheet.update();
  const before = root.querySelector('[data-testid="sheet-close"]');
  s.action = { type: 'sleep', inBed: true };
  s.needs.hunger = 3;
  sheet.update();
  expect(root.querySelector('[data-testid="sheet-close"]')).toBe(before);
  root.remove();
});

test('muestra lo que lleva encima y su peso', () => {
  const { root, world, selection, sheet } = setup();
  const s = world.survivors[0]!;
  s.carrying = { food: 6, bandage: 1, knife: 0, bat: 0 };
  selection.set(s.id);
  sheet.update();
  expect(sheetEl(root).textContent).toContain('Lleva: 6 latas y 1 venda (3,1 / 8 kg)');
  root.remove();
});

test('la casilla Saquear da la orden y no se reconstruye', () => {
  const { root, world, selection, sheet } = setup();
  const s = world.survivors[0]!;
  s.work.loot = true;
  selection.set(s.id);
  sheet.update();
  const box = root.querySelector('[data-testid="sheet-loot"]') as HTMLInputElement;
  expect(box.checked).toBe(true);
  box.click();
  expect(world.orders).toContainEqual({
    type: 'setWork',
    survivorId: s.id,
    work: 'loot',
    enabled: false,
  });
  s.needs.hunger = 2;
  sheet.update();
  expect(root.querySelector('[data-testid="sheet-loot"]')).toBe(box);
  root.remove();
});
