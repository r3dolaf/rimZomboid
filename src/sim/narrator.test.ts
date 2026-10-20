import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from './balance';
import { checkInvariants } from './invariants';
import { createWorld } from './world';

test('por defecto, narrador Equilibrado en calma; el primer suceso, al día y medio', () => {
  const w = createWorld(4);
  expect(w.narrator.style).toBe('balanced');
  expect(w.narrator.phase).toBe('calm');
  expect(w.narrator.nextEventAt).toBe(1.5 * TICKS_PER_DAY);
  expect(w.narrator.phaseEndsAt).toBeGreaterThanOrEqual(2 * TICKS_PER_DAY);
  expect(w.narrator.phaseEndsAt).toBeLessThanOrEqual(3 * TICKS_PER_DAY);
  expect(w.narrator.lastAt).toEqual({});
  expect(w.decisions).toEqual([]);
  expect(w.stormUntil).toBe(0);
  for (const s of w.survivors) {
    expect(s.sick).toBeNull();
    expect(s.celebrated).toBe(false);
  }
});

test('el estilo no cambia el resto del mundo (se sortea después de todo)', () => {
  const a = createWorld(7);
  const b = createWorld(7, 'chaotic');
  expect(b.narrator.style).toBe('chaotic');
  expect({ ...b, narrator: a.narrator }).toEqual(a);
});

test('invariantes: decisiones de colonos que no existen y gripe sin fin', () => {
  const w = createWorld(3);
  w.decisions.push({ id: 90, kind: 'birthday', survivorIds: [999], expiresAt: 100 });
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  w.decisions = [{ id: 90, kind: 'birthday', survivorIds: [w.survivors[0]!.id], expiresAt: 100 }];
  expect(checkInvariants(w)).toEqual([]);
  w.survivors[1]!.sick = { until: Number.NaN, resting: false };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});
