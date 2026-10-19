import { expect, test } from 'vitest';
import { gameTime } from './clock';

test('el tick 0 es el Día 1 a las 08:00', () =>
  expect(gameTime(0)).toEqual({ day: 1, hour: 8, minute: 0 }));
test('una hora son 300 ticks', () => expect(gameTime(300)).toEqual({ day: 1, hour: 9, minute: 0 }));
test('5 ticks son 1 minuto', () => expect(gameTime(5)).toEqual({ day: 1, hour: 8, minute: 1 }));
test('a medianoche cambia el día', () =>
  expect(gameTime(16 * 300)).toEqual({ day: 2, hour: 0, minute: 0 }));
