// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createWorld } from '../sim/world';
import { mountCards } from './cards';
import { createSelection } from './selection';

function setup() {
  const root = document.createElement('div');
  const world = createWorld(5);
  const selection = createSelection();
  const cards = mountCards(root, { world, selection });
  cards.update();
  return { root, world, selection, cards };
}

test('una tarjeta por superviviente con su nombre y cuatro barras (también Social)', () => {
  const { root, world } = setup();
  for (const s of world.survivors) {
    const card = root.querySelector(`[data-testid="card-${s.id}"]`)!;
    expect(card.textContent).toContain(s.name);
    expect(card.querySelectorAll('.bar')).toHaveLength(4);
    expect(card.querySelector('[data-need="social"]')).not.toBeNull();
  }
});

test('la barra Social es amarilla por debajo de 35 y roja por debajo de 20', () => {
  const { root, world, cards } = setup();
  const s = world.survivors[0]!;
  const fill = () =>
    root.querySelector(`[data-testid="card-${s.id}"] [data-need="social"] .fill`) as HTMLElement;
  s.needs.social = 30;
  cards.update();
  expect(fill().classList.contains('warn')).toBe(true);
  s.needs.social = 19;
  cards.update();
  expect(fill().classList.contains('bad')).toBe(true);
});

test('💕 junto al nombre si tiene pareja', () => {
  const { root, world, cards } = setup();
  const [a, b] = world.survivors;
  const love = () => root.querySelector(`[data-testid="card-${a!.id}"] .love`) as HTMLElement;
  expect(love().hidden).toBe(true);
  a!.partnerId = b!.id;
  b!.partnerId = a!.id;
  cards.update();
  expect(love().hidden).toBe(false);
  expect(love().textContent).toBe('💕');
});

test('las tarjetas aparecen y desaparecen según quién está en la colonia', () => {
  const { root, world, cards } = setup();
  const newcomer = { ...structuredClone(world.survivors[0]!), id: 50, name: 'Zoe' };
  world.survivors.push(newcomer);
  cards.update();
  const card = root.querySelector('[data-testid="card-50"]');
  expect(card?.textContent).toContain('Zoe');
  expect(root.querySelectorAll('.card')).toHaveLength(4);
  world.survivors.splice(0, 1);
  cards.update();
  expect(root.querySelectorAll('.card')).toHaveLength(3);
  expect(root.querySelector('[data-testid="card-50"]')).toBe(card); // no se rehace
});

test('las barras reflejan el valor y su nivel', () => {
  const { root, world, cards } = setup();
  const s = world.survivors[0]!;
  s.needs.hunger = 12;
  cards.update();
  const fill = root.querySelector(
    `[data-testid="card-${s.id}"] [data-need="hunger"] .fill`,
  ) as HTMLElement;
  expect(fill.style.width).toBe('12%');
  expect(fill.classList.contains('bad')).toBe(true);
});

test('clic en una tarjeta la selecciona y la marca', () => {
  const { root, world, selection, cards } = setup();
  const s = world.survivors[1]!;
  (root.querySelector(`[data-testid="card-${s.id}"]`) as HTMLElement).click();
  cards.update();
  expect(selection.id).toBe(s.id);
  expect(root.querySelector(`[data-testid="card-${s.id}"]`)!.classList.contains('selected')).toBe(
    true,
  );
});

test('muestra el icono de estado', () => {
  const { root, world, cards } = setup();
  const s = world.survivors[0]!;
  s.action = { type: 'sleep', inBed: true };
  cards.update();
  expect(root.querySelector(`[data-testid="card-${s.id}"] .status`)!.textContent).toBe('💤');
});

test('el nombre de la tarjeta es solo el nombre (el 💕 va aparte)', () => {
  const { root, world, cards } = setup();
  const [a, b] = world.survivors;
  a!.partnerId = b!.id;
  b!.partnerId = a!.id;
  cards.update();
  expect(root.querySelector(`[data-testid="card-${a!.id}"] .name`)!.textContent).toBe(a!.name);
});
