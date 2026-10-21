import { expect, test, vi } from 'vitest';
import { createTool } from './tool';

test('una herramienta activa a la vez (Saquear, Talar o Construir), y avisa al cambiar', () => {
  const t = createTool();
  const cb = vi.fn();
  t.onChange(cb);
  expect(t.mode).toBeNull();
  expect(t.active).toBe(false);
  t.toggle('loot');
  expect(t.mode).toBe('loot');
  expect(t.active).toBe(true);
  t.toggle('chop');
  expect(t.mode).toBe('chop');
  t.toggle('chop');
  expect(t.mode).toBeNull();
  t.set(null);
  expect(cb.mock.calls).toEqual([['loot'], ['chop'], [null]]);
});

test('Construir recuerda qué se va a construir', () => {
  const t = createTool();
  expect(t.buildKind).toBe('woodWall');
  t.setBuildKind('bed');
  expect(t.buildKind).toBe('bed');
});
