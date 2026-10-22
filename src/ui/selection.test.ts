import { expect, test, vi } from 'vitest';
import { createSelection } from './selection';

test('guarda la selección y avisa solo cuando cambia', () => {
  const sel = createSelection();
  const cb = vi.fn();
  sel.onChange(cb);
  expect(sel.id).toBeNull();
  sel.set(2);
  sel.set(2);
  sel.set(null);
  expect(sel.id).toBeNull();
  expect(cb.mock.calls).toEqual([[2], [null]]);
});

test('varios (H4e): Mayús añade o quita, el rectángulo elige a todos; `id` solo si hay uno', () => {
  const sel = createSelection();
  const cb = vi.fn();
  sel.onChange(cb);
  sel.set(2);
  sel.toggle(5);
  expect(sel.ids).toEqual([2, 5]);
  expect(sel.id).toBeNull();
  sel.toggle(2);
  expect(sel.ids).toEqual([5]);
  expect(sel.id).toBe(5);
  sel.setMany([1, 3, 3]);
  expect(sel.ids).toEqual([1, 3]);
  sel.setMany([1, 3]); // igual: no avisa
  sel.set(null);
  expect(sel.ids).toEqual([]);
  expect(cb.mock.calls).toEqual([[2], [null], [5], [null], [null]]);
});
