// @vitest-environment jsdom
// H5b §8: la ropa en pantalla.
import { expect, test } from 'vitest';
import { logEvent, type LogEntry } from '../sim/log';
import { emptyWorld } from '../sim/testing/fixtures';
import { logText } from './describe';
import { LOG_CATEGORY } from './logPanel';

const e = (x: Parameters<typeof logEvent>[1]) => ({ tick: 0, ...x }) as LogEntry;

test('registro: a quién se le rompe qué y por dónde (Combate)', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  expect(
    logText(
      e({ kind: 'clothesTorn', survivorId: s.id, garment: 'denimJacket', part: 'leftArm' }),
      w,
    ),
  ).toBe(`A ${s.name} se le ha roto la chaqueta vaquera por el brazo izquierdo`);
  expect(
    logText(e({ kind: 'clothesTorn', survivorId: s.id, garment: 'jeans', part: 'rightLeg' }), w),
  ).toBe(`A ${s.name} se le han roto los vaqueros por la pierna derecha`);
  expect(LOG_CATEGORY.clothesTorn).toBe('combat');
});
