import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../sim/balance';
import { NIGHT_ALPHA, nightAlpha, skyAlpha, STORM_ALPHA } from './daylight';

/** Tick de una hora (con decimales) del día 1; la partida empieza a las 08:00. */
const at = (hour: number) => Math.round(((hour - 8 + 24) % 24) * TICKS_PER_HOUR);

test.each([
  [12, 0],
  [18.9, 0],
  [19, 0],
  [20, NIGHT_ALPHA / 2],
  [21, NIGHT_ALPHA],
  [0, NIGHT_ALPHA],
  [5, NIGHT_ALPHA],
  [6, NIGHT_ALPHA / 2],
  [7, 0],
  [8, 0],
])('a las %f h la oscuridad es %f', (hour, alpha) => {
  expect(nightAlpha(at(hour))).toBeCloseTo(alpha, 5);
});

test('la oscuridad máxima es 0,55', () => expect(NIGHT_ALPHA).toBe(0.55));

test('con tormenta el cielo se oscurece un poco más, sin pasar del máximo de noche + tormenta', () => {
  expect(skyAlpha(at(12), false)).toBe(0);
  expect(skyAlpha(at(12), true)).toBeCloseTo(STORM_ALPHA, 5);
  expect(skyAlpha(at(0), true)).toBeCloseTo(NIGHT_ALPHA + STORM_ALPHA, 5);
  expect(NIGHT_ALPHA + STORM_ALPHA).toBeLessThan(0.85);
});
