// Partida larga sin pantalla: solo IA, a toda velocidad. Comprueba que nada se rompe.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/balance';
import { checkInvariants } from '../src/sim/invariants';
import { step } from '../src/sim/step';
import { createWorld } from '../src/sim/world';

const DAYS = Number(process.env.SOAK_DAYS || 30);

test('SOAK_DAYS es un número de días válido', () => {
  expect(Number.isInteger(DAYS) && DAYS > 0).toBe(true);
});

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días sin romper invariantes ni bloquearse`,
  (seed) => {
    const w = createWorld(seed);
    for (let day = 1; day <= DAYS; day++) {
      const moved = w.survivors.map(() => false);
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const before = w.survivors.map((s) => ({ ...s.pos }));
        step(w);
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        w.survivors.forEach((s, j) => {
          if (s.pos.x !== before[j]!.x || s.pos.y !== before[j]!.y) moved[j] = true;
        });
      }
      // sin bloqueos: cada superviviente se ha movido en algún momento del día
      w.survivors.forEach((s, j) =>
        expect(moved[j], `día ${day}: ${s.name} no se ha movido`).toBe(true),
      );
    }
    expect(w.tick).toBe(DAYS * TICKS_PER_DAY);
  },
  120_000,
);
