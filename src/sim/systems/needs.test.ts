import { expect, test } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../balance';
import { emptyWorld } from '../testing/fixtures';
import { needsSystem } from './needs';

function run(ticks: number, setup: (w: ReturnType<typeof emptyWorld>) => void = () => {}) {
  const w = emptyWorld(5, 5);
  setup(w);
  for (let i = 0; i < ticks; i++) {
    needsSystem(w);
    w.tick++;
  }
  return w.survivors[0]!;
}

test('el hambre baja 70 en un día', () => {
  expect(run(TICKS_PER_DAY).needs.hunger).toBeCloseTo(30, 5);
});

test('el Glotón pierde el hambre 1,5 veces más rápido', () => {
  const s = run(TICKS_PER_DAY / 2, (w) => (w.survivors[0]!.traits = ['glutton']));
  expect(s.needs.hunger).toBeCloseTo(100 - 70 * 0.5 * 1.5, 5);
});

test('despierto, el sueño se vacía en 16 h', () => {
  expect(run(16 * TICKS_PER_HOUR).needs.sleep).toBeCloseTo(0, 5);
  expect(run(8 * TICKS_PER_HOUR).needs.sleep).toBeCloseTo(50, 5);
});

test('el Dormilón se cansa 1,3 veces más rápido', () => {
  const s = run(8 * TICKS_PER_HOUR, (w) => (w.survivors[0]!.traits = ['sleepyhead']));
  expect(s.needs.sleep).toBeCloseTo(100 - 50 * 1.3, 5);
});

test('en cama, 8 h llenan el sueño; en el suelo, al 75 %', () => {
  const bed = run(4 * TICKS_PER_HOUR, (w) => {
    const s = w.survivors[0]!;
    s.needs.sleep = 0;
    s.action = { type: 'sleep', inBed: true };
  });
  expect(bed.needs.sleep).toBeCloseTo(50, 5);
  const floor = run(4 * TICKS_PER_HOUR, (w) => {
    const s = w.survivors[0]!;
    s.needs.sleep = 0;
    s.action = { type: 'sleep', inBed: false };
  });
  expect(floor.needs.sleep).toBeCloseTo(37.5, 5);
});

test('las necesidades no salen de 0–100', () => {
  expect(run(3 * TICKS_PER_DAY).needs.hunger).toBe(0);
  const s = run(
    20 * TICKS_PER_HOUR,
    (w) => (w.survivors[0]!.action = { type: 'sleep', inBed: true }),
  );
  expect(s.needs.sleep).toBe(100);
});

test('los recuerdos caducados desaparecen', () => {
  const s = run(10, (w) => {
    w.survivors[0]!.memories = [
      { id: 'ate', expiresAt: 5 },
      { id: 'sleptInBed', expiresAt: 50 },
    ];
  });
  expect(s.memories.map((m) => m.id)).toEqual(['sleptInBed']);
});
