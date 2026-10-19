import { expect, test, vi } from 'vitest';
import { createTool } from './tool';

test('la herramienta Saquear se activa, se desactiva y avisa al cambiar', () => {
  const t = createTool();
  const cb = vi.fn();
  t.onChange(cb);
  expect(t.active).toBe(false);
  t.toggle();
  expect(t.active).toBe(true);
  t.set(false);
  t.set(false);
  expect(cb.mock.calls).toEqual([[true], [false]]);
});
