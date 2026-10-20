// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { bindEscape } from './escape';
import { createSelection } from './selection';
import { createTool } from './tool';

test('Esc cierra solo la capa de más arriba: herramienta, casa y superviviente', () => {
  const target = new EventTarget();
  const tool = createTool();
  const house = createSelection();
  const survivor = createSelection();
  bindEscape(target, [
    () => tool.active && (tool.set(false), true),
    () => house.id !== null && (house.set(null), true),
    () => survivor.id !== null && (survivor.set(null), true),
  ]);
  const esc = () => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  tool.set(true);
  house.set(4);
  survivor.set(2);
  esc();
  expect([tool.active, house.id, survivor.id]).toEqual([false, 4, 2]);
  esc();
  expect([tool.active, house.id, survivor.id]).toEqual([false, null, 2]);
  esc();
  expect([tool.active, house.id, survivor.id]).toEqual([false, null, null]);
});

test('otras teclas no hacen nada', () => {
  const target = new EventTarget();
  const tool = createTool();
  tool.set(true);
  bindEscape(target, [() => tool.active && (tool.set(false), true)]);
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
  expect(tool.active).toBe(true);
});
