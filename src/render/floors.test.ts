// H4f §6: suelo según el tipo de edificio.
import { expect, test } from 'vitest';
import { FLOOR_COLORS, floorOf } from './colors';

test('baldosa clara en las tiendas, cemento en la comisaría y la nave, tablas en la granja; casas y base, como siempre', () => {
  for (const k of ['supermarket', 'pharmacy', 'hardware', 'clothes', 'gas'] as const)
    expect(floorOf(k)).toBe('tiles');
  for (const k of ['police', 'warehouse'] as const) expect(floorOf(k)).toBe('concrete');
  expect(floorOf('farm')).toBe('planks');
  expect(floorOf('house')).toBeNull();
  expect(floorOf('base')).toBeNull();
  expect(new Set(Object.values(FLOOR_COLORS)).size).toBe(3);
});
