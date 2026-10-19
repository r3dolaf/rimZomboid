// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createTimeController } from '../game/timeController';
import { formatDayTime, mountHud } from './hud';

test('formatDayTime rellena con ceros', () => {
  expect(formatDayTime({ day: 3, hour: 7, minute: 5 })).toBe('Día 3, 07:05');
});

test('el HUD muestra la semilla y marca la velocidad activa', () => {
  const root = document.createElement('div');
  const time = createTimeController();
  mountHud(root, { seed: 42, time });
  expect(root.querySelector('[data-testid="hud-seed"]')!.textContent).toBe('Semilla: 42');
  expect(root.querySelector('[data-speed="1"]')!.classList.contains('active')).toBe(true);
  (root.querySelector('[data-speed="3"]') as HTMLButtonElement).click();
  expect(time.speed).toBe(3);
  expect(root.querySelector('[data-speed="3"]')!.classList.contains('active')).toBe(true);
  expect(root.querySelector('[data-speed="1"]')!.classList.contains('active')).toBe(false);
});

test('update cambia la hora y refleja cambios de velocidad hechos con el teclado', () => {
  const root = document.createElement('div');
  const time = createTimeController();
  const hud = mountHud(root, { seed: 1, time });
  time.togglePause();
  hud.update({ day: 2, hour: 13, minute: 30 });
  expect(root.querySelector('[data-testid="hud-time"]')!.textContent).toBe('Día 2, 13:30');
  expect(root.querySelector('[data-speed="0"]')!.classList.contains('active')).toBe(true);
});

test('el botón de pausa tiene un nombre accesible', () => {
  const root = document.createElement('div');
  mountHud(root, { seed: 1, time: createTimeController() });
  expect(root.querySelector('[data-speed="0"]')!.getAttribute('aria-label')).toBe('Pausa');
});

test('al pulsar un botón de velocidad, este pierde el foco (Espacio no lo vuelve a pulsar)', () => {
  const root = document.createElement('div');
  document.body.append(root);
  mountHud(root, { seed: 1, time: createTimeController() });
  const b = root.querySelector('[data-speed="2"]') as HTMLButtonElement;
  b.focus();
  b.click();
  expect(document.activeElement).not.toBe(b);
  root.remove();
});
