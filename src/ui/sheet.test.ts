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
  s.carrying = {
    food: 6,
    bandage: 1,
    knife: 0,
    bat: 0,
    axe: 0,
    wood: 0,
    cloth: 0,
    curtains: 0,
    thread: 0,
    needle: 0,
    crowbar: 0,
    machete: 0,
  };
  s.skills.haul.level = 5;
  selection.set(s.id);
  sheet.update();
  expect(sheetEl(root).textContent).toContain('Lleva: 6 latas y 1 venda (3,1 / 8 kg)');
  s.skills.haul.level = 3; // su capacidad, según Transportar
  sheet.update();
  expect(sheetEl(root).textContent).toContain('(3,1 / 7,2 kg)');
  root.remove();
});

test('una prioridad por trabajo ("—" sin permiso) y "En la mano: hacha"', () => {
  const { root, world, selection, sheet } = setup();
  const s = world.survivors[0]!;
  s.work = {
    heal: false,
    social: true,
    build: false,
    craft: false,
    haul: true,
    chop: false,
    loot: true,
  };
  s.priorities = { heal: 3, social: 3, build: 3, craft: 3, haul: 1, chop: 3, loot: 4 };
  s.equipped = 'axe';
  selection.set(s.id);
  sheet.update();
  const cell = (k: string) =>
    root.querySelector(`[data-testid="sheet-work-${k}"]`) as HTMLButtonElement;
  const prio = (k: string) => cell(k).querySelector('.prio')!.textContent;
  expect(['social', 'build', 'craft', 'haul', 'chop', 'loot'].map(prio)).toEqual([
    '3',
    '—',
    '—',
    '1',
    '—',
    '4',
  ]);
  expect(cell('haul').textContent).toContain('Transportar');
  cell('build').click();
  expect(world.orders).toEqual([
    { type: 'setWork', survivorId: s.id, work: 'build', enabled: true },
    { type: 'setPriority', survivorId: s.id, work: 'build', priority: 1 },
  ]);
  sheet.update();
  expect(prio('build')).toBe('1');
  expect(sheetEl(root).textContent).toContain('En la mano: hacha');
  root.remove();
});

test('la prioridad de Saquear da su orden y no se reconstruye', () => {
  const { root, world, selection, sheet } = setup();
  const s = world.survivors[0]!;
  s.work.loot = true;
  s.priorities.loot = 4;
  selection.set(s.id);
  sheet.update();
  const cell = root.querySelector('[data-testid="sheet-work-loot"]') as HTMLButtonElement;
  expect(cell.querySelector('.prio')!.textContent).toBe('4');
  cell.click();
  expect(world.orders).toContainEqual({
    type: 'setWork',
    survivorId: s.id,
    work: 'loot',
    enabled: false,
  });
  s.needs.hunger = 2;
  sheet.update();
  expect(root.querySelector('[data-testid="sheet-work-loot"]')).toBe(cell);
  expect(cell.querySelector('.prio')!.textContent).toBe('—');
  root.remove();
});

test('sección Relaciones: pareja y opiniones ordenadas con su etiqueta', () => {
  const { root, world, selection, sheet } = setup();
  const [a, b, c] = world.survivors;
  a!.opinions = { [b!.id]: 45.4, [c!.id]: -60 };
  a!.partnerId = b!.id;
  b!.partnerId = a!.id;
  selection.set(a!.id);
  sheet.update();
  const el = sheetEl(root);
  expect(el.textContent).toContain('Relaciones');
  expect(el.textContent).toContain(`Pareja: ${b!.name}`);
  const items = [...el.querySelectorAll('[data-testid="relation"]')].map((li) => li.textContent);
  expect(items).toEqual([`${b!.name}: +45 · Pareja`, `${c!.name}: −60 · Rivalidad`]);
  a!.partnerId = null;
  b!.partnerId = null;
  a!.opinions[b!.id] = 41;
  sheet.update();
  expect(el.textContent).not.toContain('Pareja:');
  expect(el.querySelector('[data-testid="relation"]')!.textContent).toBe(
    `${b!.name}: +41 · Amistad`,
  );
  root.remove();
});

test('los motivos del ánimo con otra persona llevan su nombre', () => {
  const { root, world, selection, sheet } = setup();
  const [a, b] = world.survivors;
  a!.traits = [];
  a!.needs.hunger = 100;
  a!.needs.sleep = 100;
  addMemory(a!, 'goodChat', 0, b!.id);
  addMemory(a!, 'insulted', 0, b!.id);
  selection.set(a!.id);
  sheet.update();
  const items = [...sheetEl(root).querySelectorAll('[data-testid="modifier"]')].map(
    (li) => li.textContent,
  );
  expect(items).toContain(`Buena charla con ${b!.name} +3 (quedan 6 h)`);
  expect(items).toContain(`Le insultó ${b!.name} −8 (quedan 12 h)`);
  root.remove();
});
