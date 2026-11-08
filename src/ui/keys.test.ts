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

test('M silencia o vuelve a dar sonido (S1)', () => {
  const time = createTimeController();
  const toggleMute = vi.fn();
  bindTimeKeys(window, time, undefined, { toggleMute });
  press(window, { code: 'KeyM', key: 'm' });
  expect(toggleMute).toHaveBeenCalledTimes(1);
});

test('U1: I, E y P abren Almacén, Expediciones y Partida; H y ? la Ayuda', () => {
  const time = createTimeController();
  const calls = {
    toggleStorage: vi.fn(),
    toggleExpeditions: vi.fn(),
    toggleGame: vi.fn(),
    toggleHelp: vi.fn(),
  };
  bindTimeKeys(window, time, undefined, calls);
  press(window, { code: 'KeyI', key: 'i' });
  press(window, { code: 'KeyE', key: 'e' });
  press(window, { code: 'KeyP', key: 'p' });
  press(window, { code: 'KeyH', key: 'h' });
  press(window, { code: 'Minus', key: '?' }); // en un teclado español, Mayús y la tecla del '
  expect(calls.toggleStorage).toHaveBeenCalledTimes(1);
  expect(calls.toggleExpeditions).toHaveBeenCalledTimes(1);
  expect(calls.toggleGame).toHaveBeenCalledTimes(1);
  expect(calls.toggleHelp).toHaveBeenCalledTimes(2);
});

test('U1: escribiendo en un campo, las teclas no hacen nada (ni Espacio)', () => {
  const time = createTimeController();
  const tool = createTool();
  const toggleCraft = vi.fn();
  bindTimeKeys(window, time, tool, { toggleCraft });
  for (const tag of ['input', 'select', 'textarea'] as const) {
    const field = document.createElement(tag);
    document.body.append(field);
    const space = press(field, { code: 'Space', key: ' ' });
    press(field, { code: 'KeyL', key: 'l' });
    press(field, { code: 'KeyF', key: 'f' });
    press(field, { code: 'Digit3', key: '3' });
    expect(space.defaultPrevented).toBe(false);
    field.remove();
  }
  expect(time.speed).toBe(1);
  expect(tool.mode).toBeNull();
  expect(toggleCraft).not.toHaveBeenCalled();
});

test('U1: con Ctrl, Alt o Cmd no hacen nada (Ctrl+F busca en la página)', () => {
  const time = createTimeController();
  const toggleCraft = vi.fn();
  bindTimeKeys(window, time, undefined, { toggleCraft });
  press(window, { code: 'KeyF', key: 'f', ctrlKey: true });
  press(window, { code: 'KeyF', key: 'f', metaKey: true });
  press(window, { code: 'KeyF', key: 'f', altKey: true });
  expect(toggleCraft).not.toHaveBeenCalled();
});
