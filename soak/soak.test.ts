// Partida larga sin pantalla: solo IA, a toda velocidad. Comprueba que nada se rompe.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/balance';
import { checkInvariants } from '../src/sim/invariants';
import { step } from '../src/sim/step';
import { isEmpty } from '../src/sim/items';
import { issue } from '../src/sim/orders';
import { createWorld } from '../src/sim/world';
import { targetContainerId } from '../src/sim/work';

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
      // H2: con ~10 días de comida, el almacén está vacío antes del día 15
      if (day === 15) expect(w.storage.items.food, 'comida el día 15').toBe(0);
      // sin bloqueos: cada superviviente se ha movido en algún momento del día
      w.survivors.forEach((s, j) =>
        expect(moved[j], `día ${day}: ${s.name} no se ha movido`).toBe(true),
      );
    }
    expect(w.tick).toBe(DAYS * TICKS_PER_DAY);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días con todas las casas marcadas — el mapa se vacía sin romper nada`,
  (seed) => {
    const w = createWorld(seed);
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) {
      step(w);
      const problems = checkInvariants(w);
      if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
      const targets = w.survivors.map(targetContainerId).filter((id) => id !== null);
      if (new Set(targets).size !== targets.length)
        expect(targets, `tick ${w.tick}`).toEqual('únicos');
    }
    for (const c of w.containers) expect(isEmpty(c.items), `contenedor ${c.id}`).toBe(true);
    for (const s of w.survivors) expect(isEmpty(s.carrying), s.name).toBe(true);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días aceptando a todos los desconocidos — relaciones sanas y sin bloqueos`,
  (seed) => {
    const w = createWorld(seed);
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    for (let day = 1; day <= DAYS; day++) {
      const present = new Set(w.survivors.map((s) => s.id));
      const moved = new Set<number>();
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const d = w.decisions.find((x) => x.kind === 'stranger');
        if (d && w.orders.length === 0) issue(w, { type: 'decide', decisionId: d.id, option: 0 });
        const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
        step(w);
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const s of w.survivors) {
          const b = before.get(s.id);
          if (b && (b.x !== s.pos.x || b.y !== s.pos.y)) moved.add(s.id);
        }
      }
      for (const s of w.survivors)
        if (present.has(s.id))
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
    }
    if (DAYS >= 10) expect(w.survivors.length, 'han llegado y se han unido').toBeGreaterThan(3);
  },
  240_000,
);
