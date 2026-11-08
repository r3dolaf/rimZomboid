// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { createTimeController } from '../game/timeController';
import { createFlag } from './flag';
import { mountHelp } from './help';

const q = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-testid="${id}"]`) as HTMLElement;

test('U1 §8: la Ayuda se abre y se cierra, con cuatro pestañas', () => {
  const root = document.createElement('div');
  const open = createFlag();
  mountHelp(root, { open, touch: () => false });
  expect(q(root, 'help-panel').hidden).toBe(true);
  open.set(true);
  expect(q(root, 'help-panel').hidden).toBe(false);
  const tabs = [...root.querySelectorAll('[role="tab"]')].map((b) => b.textContent);
  expect(tabs).toEqual(['Cómo se juega', 'Controles', 'La pantalla', 'Consejos']);
  expect(q(root, 'help-panel').textContent).toContain('trabajan solos');
  q(root, 'help-tab-tips').click();
  expect(q(root, 'help-tab-tips').classList.contains('selected')).toBe(true);
  expect(root.querySelectorAll('.help-tips li').length).toBeGreaterThan(5);
  q(root, 'help-close').click();
  expect(open.value).toBe(false);
  expect(q(root, 'help-panel').hidden).toBe(true);
});

test('U1 §8: los controles del aparato van primero', () => {
  for (const [touch, first] of [
    [false, 'Con ratón y teclado'],
    [true, 'Con el dedo'],
  ] as const) {
    const root = document.createElement('div');
    const open = createFlag();
    mountHelp(root, { open, touch: () => touch });
    open.set(true);
    q(root, 'help-tab-controls').click();
    const heads = [...root.querySelectorAll('h3')].map((h) => h.textContent);
    expect(heads[0]).toBe(first);
    expect(heads).toHaveLength(2);
  }
});

test('U1 §8: La pantalla enseña las barras con el estilo de la tarjeta', () => {
  const root = document.createElement('div');
  mountHelp(root, { open: createFlag(true), touch: () => false });
  const bars = [...root.querySelectorAll('.help-bar .bar')] as HTMLElement[];
  expect(bars.map((b) => b.dataset.need)).toEqual([
    'health',
    'blood',
    'hunger',
    'sleep',
    'social',
    'mood',
  ]);
});

test('U1 §8: en la partida pausa al abrir y sigue al cerrar (si nadie la ha tocado)', () => {
  const root = document.createElement('div');
  const open = createFlag();
  const time = createTimeController();
  time.setSpeed(2);
  mountHelp(root, { open, time, touch: () => false });
  open.set(true);
  expect(time.speed).toBe(0);
  open.set(false);
  expect(time.speed).toBe(2);
  // Ya en pausa: la deja como estaba.
  time.setSpeed(0);
  open.set(true);
  open.set(false);
  expect(time.speed).toBe(0);
  // Si el jugador cambia la velocidad con la Ayuda abierta, manda lo suyo.
  time.setSpeed(1);
  open.set(true);
  time.setSpeed(3);
  open.set(false);
  expect(time.speed).toBe(3);
});

test('U1 §8: abajo, ver otra vez los primeros pasos y mostrar consejos', () => {
  const root = document.createElement('div');
  document.body.replaceChildren(root); // (las casillas solo avisan del cambio dentro de la página)
  const open = createFlag();
  const onGuide = vi.fn();
  let tipsOn = true;
  mountHelp(root, {
    open,
    touch: () => false,
    onGuide,
    tips: { get: () => tipsOn, set: (on) => (tipsOn = on) },
  });
  open.set(true);
  const check = q(root, 'help-show-tips') as HTMLInputElement;
  expect(check.checked).toBe(true);
  check.click();
  expect(tipsOn).toBe(false);
  q(root, 'help-guide-again').click();
  expect(onGuide).toHaveBeenCalledTimes(1);
  expect(open.value).toBe(false);
});
