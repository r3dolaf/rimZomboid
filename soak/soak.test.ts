// Partida larga sin pantalla: solo IA, a toda velocidad. Comprueba que nada se rompe.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/balance';
import { checkInvariants } from '../src/sim/invariants';
import { step } from '../src/sim/step';
import { createWorld } from '../src/sim/world';

const DAYS = Number(process.env.SOAK_DAYS ?? 30);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días sin romper invariantes`,
  (seed) => {
    const w = createWorld(seed);
    for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) {
      step(w);
      if (i % 600 === 0) expect(checkInvariants(w), `tick ${w.tick}`).toEqual([]);
    }
    expect(checkInvariants(w)).toEqual([]);
    expect(w.tick).toBe(DAYS * TICKS_PER_DAY);
  },
  120_000,
);
