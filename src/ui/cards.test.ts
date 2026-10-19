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

test('una tarjeta por superviviente con su nombre y tres barras', () => {
  const { root, world } = setup();
  for (const s of world.survivors) {
    const card = root.querySelector(`[data-testid="card-${s.id}"]`)!;
    expect(card.textContent).toContain(s.name);
    expect(card.querySelectorAll('.bar')).toHaveLength(3);
  }
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
