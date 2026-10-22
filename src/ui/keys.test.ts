// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { createTimeController } from '../game/timeController';
import { bindTimeKeys } from './keys';
import { createTool } from './tool';

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

test('Espacio pausa y reanuda', () => {
  const time = createTimeController();
  bindTimeKeys(window, time);
  press(window, { code: 'Space', key: ' ' });
  expect(time.speed).toBe(0);
  press(window, { code: 'Space', key: ' ' });
  expect(time.speed).toBe(1);
});

test('mantener Espacio pulsado no alterna la pausa una y otra vez', () => {
  const time = createTimeController();
  bindTimeKeys(window, time);
  press(window, { code: 'Space', key: ' ' });
  press(window, { code: 'Space', key: ' ', repeat: true });
  press(window, { code: 'Space', key: ' ', repeat: true });
  expect(time.speed).toBe(0);
});

test('Espacio no activa el botón que tenga el foco', () => {
  const time = createTimeController();
  bindTimeKeys(window, time);
  const e = press(window, { code: 'Space', key: ' ' });
  expect(e.defaultPrevented).toBe(true);
});

test('1, 2 y 3 cambian la velocidad', () => {
  const time = createTimeController();
  bindTimeKeys(window, time);
  press(window, { code: 'Digit3', key: '3' });
  expect(time.speed).toBe(3);
  press(window, { code: 'Digit2', key: '2' });
  expect(time.speed).toBe(2);
});

test('L, T y B activan y desactivan Saquear, Talar y Construir (Esc: ver escape.test.ts)', () => {
  const time = createTimeController();
  const tool = createTool();
  bindTimeKeys(window, time, tool);
  press(window, { code: 'KeyL', key: 'l' });
  expect(tool.mode).toBe('loot');
  press(window, { code: 'KeyT', key: 't' });
  expect(tool.mode).toBe('chop');
  press(window, { code: 'KeyB', key: 'b' });
  expect(tool.mode).toBe('build');
  press(window, { code: 'KeyB', key: 'b' });
  expect(tool.mode).toBeNull();
});

test('J abre y cierra el panel de Trabajos', () => {
  const time = createTimeController();
  const toggleWork = vi.fn();
  bindTimeKeys(window, time, undefined, { toggleWork });
  press(window, { code: 'KeyJ', key: 'j' });
  expect(toggleWork).toHaveBeenCalledTimes(1);
});

test('F abre y cierra el panel Fabricar (H4d)', () => {
  const time = createTimeController();
  const toggleCraft = vi.fn();
  bindTimeKeys(window, time, undefined, { toggleCraft });
  press(window, { code: 'KeyF', key: 'f' });
  expect(toggleCraft).toHaveBeenCalledTimes(1);
});

test('R: modo combate para los elegidos (H4e)', () => {
  const time = createTimeController();
  const toggleDraft = vi.fn();
  bindTimeKeys(window, time, undefined, { toggleDraft });
  press(window, { code: 'KeyR', key: 'r' });
  expect(toggleDraft).toHaveBeenCalledTimes(1);
});
