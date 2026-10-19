// @vitest-environment jsdom
import { expect, test } from 'vitest';
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

test('L activa y desactiva la herramienta Saquear; Esc la desactiva', () => {
  const time = createTimeController();
  const tool = createTool();
  bindTimeKeys(window, time, tool);
  press(window, { code: 'KeyL', key: 'l' });
  expect(tool.active).toBe(true);
  press(window, { code: 'Escape', key: 'Escape' });
  expect(tool.active).toBe(false);
});
