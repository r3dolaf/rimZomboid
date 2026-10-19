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
