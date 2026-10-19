import { expect, test } from 'vitest';
import { darkness, gameTime, isNight } from './clock';

test('el tick 0 es el Día 1 a las 08:00', () =>
  expect(gameTime(0)).toEqual({ day: 1, hour: 8, minute: 0 }));
test('una hora son 300 ticks', () => expect(gameTime(300)).toEqual({ day: 1, hour: 9, minute: 0 }));
test('5 ticks son 1 minuto', () => expect(gameTime(5)).toEqual({ day: 1, hour: 8, minute: 1 }));
test('a medianoche cambia el día', () =>
  expect(gameTime(16 * 300)).toEqual({ day: 2, hour: 0, minute: 0 }));

test.each([
  [21, 59, false],
  [22, 0, true],
  [3, 0, true],
  [5, 59, true],
  [6, 0, false],
  [12, 0, false],
])('a las %i:%i, ¿es de noche? %s', (h, m, esperado) => {
  // el tick 0 son las 08:00 del día 1
  const minutes = ((h - 8 + 24) % 24) * 60 + m;
  expect(isNight(minutes * 5)).toBe(esperado);
});

test.each([
  [12, 0],
  [19, 0],
  [20, 0.5],
  [21, 1],
  [2, 1],
  [5, 1],
  [6, 0.5],
  [7, 0],
])('oscuridad a las %i h: %f', (h, d) => {
  expect(darkness(((h - 8 + 24) % 24) * 300)).toBeCloseTo(d, 5);
});
