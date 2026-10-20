import { expect, test } from 'vitest';
import { changeOpinion, opinionOf, relationLabel } from './social';
import { createWorld } from './world';

test('la opinión por defecto es 0 y se limita a [−100, 100]', () => {
  const w = createWorld(2);
  const [a, b] = w.survivors;
  a!.opinions = {};
  expect(opinionOf(a!, b!.id)).toBe(0);
  changeOpinion(a!, b!.id, 150);
  expect(opinionOf(a!, b!.id)).toBe(100);
  changeOpinion(a!, b!.id, -500);
  expect(opinionOf(a!, b!.id)).toBe(-100);
});

test('etiquetas: Amigo ≥ 40, Rival ≤ −40 y Pareja si lo es', () => {
  const w = createWorld(2);
  const [a, b] = w.survivors;
  a!.opinions[b!.id] = 40;
  expect(relationLabel(a!, b!.id)).toBe('friend');
  a!.opinions[b!.id] = -40;
  expect(relationLabel(a!, b!.id)).toBe('rival');
  a!.opinions[b!.id] = 10;
  expect(relationLabel(a!, b!.id)).toBeNull();
  a!.partnerId = b!.id;
  expect(relationLabel(a!, b!.id)).toBe('partner');
});

test('al empezar: opiniones entre −10 y 20, social 60–100, sin pareja ni globo', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const w = createWorld(seed);
    for (const s of w.survivors) {
      for (const o of w.survivors) {
        if (o === s) continue;
        const v = opinionOf(s, o.id);
        expect(v).toBeGreaterThanOrEqual(-10);
        expect(v).toBeLessThanOrEqual(20);
      }
      expect(s.needs.social).toBeGreaterThanOrEqual(60);
      expect(s.needs.social).toBeLessThanOrEqual(100);
      expect(s.partnerId).toBeNull();
      expect(s.bubble).toBeNull();
    }
    expect(w.stranger).toBeNull();
  }
});
