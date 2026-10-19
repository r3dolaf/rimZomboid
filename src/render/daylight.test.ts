import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../sim/balance';
import { NIGHT_ALPHA, nightAlpha } from './daylight';

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
