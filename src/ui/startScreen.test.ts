// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { DEFAULT_SETUP } from '../sim/setup';
import { mountStartScreen } from './startScreen';

function setup() {
  const root = document.createElement('div');
  const onStart = vi.fn();
  let n = 100;
  const screen = mountStartScreen(root, { seed: 42, randomSeed: () => n++, onStart });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  return { root, onStart, screen, q };
}

test('tres narradores (Equilibrado marcado) y la semilla al azar', () => {
  const { root, q } = setup();
  const cards = [...root.querySelectorAll('[data-testid^="narrator-"]')];
  expect(cards.map((c) => c.textContent)).toEqual([
    expect.stringContaining('Tranquilo'),
    expect.stringContaining('Equilibrado'),
    expect.stringContaining('Caótico'),
  ]);
  expect(q('narrator-balanced').classList.contains('selected')).toBe(true);
  expect((q('start-seed') as HTMLInputElement).value).toBe('42');
});

test('elegir Caótico, sortear otra semilla y Empezar', () => {
  const { onStart, q } = setup();
  q('narrator-chaotic').click();
  expect(q('narrator-chaotic').classList.contains('selected')).toBe(true);
  expect(q('narrator-balanced').classList.contains('selected')).toBe(false);
  q('start-reroll').click();
  expect((q('start-seed') as HTMLInputElement).value).toBe('100');
  q('start-go').click();
  expect(onStart).toHaveBeenCalledWith(100, 'chaotic', 'normal', DEFAULT_SETUP);
});

test('con una semilla no válida no empieza', () => {
  const { onStart, q } = setup();
  (q('start-seed') as HTMLInputElement).value = 'abc';
  q('start-go').click();
  expect(onStart).not.toHaveBeenCalled();
  expect(q('start-seed').classList.contains('invalid')).toBe(true);
});

test('remove la quita de la página', () => {
  const { root, screen } = setup();
  screen.remove();
  expect(root.querySelector('[data-testid="start"]')).toBeNull();
});

test('U1 §10: de qué va en una línea, «Para empezar» en Tranquilo y Pocos, y la Ayuda', () => {
  const root = document.createElement('div');
  const onHelp = vi.fn();
  mountStartScreen(root, { seed: 1, randomSeed: () => 2, onStart: vi.fn(), onHelp });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  expect(q('start-pitch').textContent).toContain('trabajan solos');
  expect(q('narrator-calm').textContent).toContain('Para empezar');
  expect(q('narrator-balanced').textContent).not.toContain('Para empezar');
  expect(q('zombies-few').textContent).toContain('Para empezar');
  q('start-help').click();
  expect(onHelp).toHaveBeenCalledTimes(1);
  // Sin Ayuda (en algún test), sin botón.
  const other = document.createElement('div');
  mountStartScreen(other, { seed: 1, randomSeed: () => 2, onStart: vi.fn() });
  expect(other.querySelector('[data-testid="start-help"]')).toBeNull();
});

test('C2: el comienzo (el pueblo, marcado), el objetivo y los ajustes plegados llegan a la partida', () => {
  const { root, onStart, q } = setup();
  const scenarios = [...root.querySelectorAll('[data-testid^="scenario-"]')];
  expect(scenarios.map((c) => c.querySelector('strong')!.textContent)).toEqual([
    'El pueblo',
    'Solo',
    'Familia numerosa',
    'Con lo puesto',
  ]);
  expect(q('scenario-town').classList.contains('selected')).toBe(true);
  expect(q('scenario-town').textContent).toContain('Para empezar');
  expect(q('start-objective').textContent).toContain('encontrad una radio');
  const custom = q('start-custom') as HTMLDetailsElement;
  expect(custom.open).toBe(false);
  expect(custom.querySelector('summary')!.textContent).toBe('Ajustes a medida · todo normal');
  expect(q('setup-infection-normal').classList.contains('selected')).toBe(true);
  q('scenario-solo').click();
  q('setup-infection-high').click();
  q('setup-cold-low').click();
  expect(custom.querySelector('summary')!.textContent).toBe('Ajustes a medida · 2 cambiados');
  expect(q('setup-infection-high').classList.contains('selected')).toBe(true);
  expect(q('setup-infection-normal').classList.contains('selected')).toBe(false);
  q('start-go').click();
  expect(onStart).toHaveBeenCalledWith(42, 'balanced', 'normal', {
    ...DEFAULT_SETUP,
    scenario: 'solo',
    infection: 'high',
    cold: 'low',
  });
});
