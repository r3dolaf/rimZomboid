import { expect, test } from 'vitest';
import { MOODS, type Mood } from './catalog';
import { composePiece, PITCH_CLASSES, silenceAfter, type Note } from './compose';

const SEEDS = [1, 2, 3, 42, 999, 123456];
const PERCUSSION = new Set(['heart', 'tom']);

/** Las notas de los primeros compases (o de todos, si el tema termina). */
function notes(mood: Mood, seed: number, upTo = 40): Note[] {
  const p = composePiece(mood, seed);
  const n = p.bars === null ? upTo : p.bars;
  return Array.from({ length: n }, (_, k) => p.bar(k)).flat();
}

test('misma semilla, mismas notas; otra semilla, otras', () => {
  expect(composePiece('day', 7).bar(3)).toEqual(composePiece('day', 7).bar(3));
  expect(notes('day', 7)).not.toEqual(notes('day', 8));
});

test.each(MOODS)('%s: en su escala, en su registro, con volumen y duración', (mood) => {
  for (const seed of SEEDS) {
    const all = notes(mood, seed);
    expect(all.length).toBeGreaterThan(0);
    for (const n of all) {
      if (!PERCUSSION.has(n.voice)) expect(PITCH_CLASSES[mood]).toContain(n.midi % 12);
      expect(n.midi).toBeGreaterThanOrEqual(28);
      expect(n.midi).toBeLessThanOrEqual(96);
      expect(n.vel).toBeGreaterThan(0);
      expect(n.vel).toBeLessThanOrEqual(1);
      expect(n.dur).toBeGreaterThan(0);
      expect(n.at).toBeGreaterThanOrEqual(0);
    }
  }
});

test.each(['day', 'night'] as const)('%s: un tema de 90 a 150 s', (mood) => {
  for (const seed of SEEDS) {
    const p = composePiece(mood, seed);
    expect(p.bars).not.toBeNull();
    const length = p.bars! * p.barSec;
    expect(length).toBeGreaterThanOrEqual(90);
    expect(length).toBeLessThanOrEqual(150);
  }
});

test.each(['danger', 'siege'] as const)('%s: no termina', (mood) => {
  const p = composePiece(mood, 5);
  expect(p.bars).toBeNull();
  expect(p.bar(500).length).toBeGreaterThan(0);
});

test.each(['title', 'day', 'night', 'end'] as const)(
  '%s: cada compás en su sitio y nada suena después del final',
  (mood) => {
    for (const seed of SEEDS) {
      const p = composePiece(mood, seed);
      const end = p.bars! * p.barSec;
      for (let k = 0; k < p.bars!; k++)
        for (const n of p.bar(k)) {
          expect(n.at).toBeGreaterThanOrEqual(k * p.barSec - 1e-9);
          expect(n.at).toBeLessThan((k + 1) * p.barSec);
          expect(n.at + n.dur).toBeLessThanOrEqual(end + p.tail + 1e-9);
        }
      expect(p.bar(p.bars!)).toEqual([]);
    }
  },
);

test('el tema de la portada tiene su melodía: la misma con cualquier semilla al empezar', () => {
  const melody = (seed: number) =>
    composePiece('title', seed)
      .bar(0)
      .filter((n) => n.voice === 'piano' && n.midi >= 64)
      .map((n) => n.midi);
  expect(melody(1)).toEqual(melody(77));
  expect(melody(1).length).toBeGreaterThan(1);
});

test('silencio después: de 40 a 120 s de día y de noche; corto en la portada; nada en lo demás', () => {
  expect(silenceAfter('day', () => 0)).toBe(40);
  expect(silenceAfter('night', () => 0.999999)).toBeCloseTo(120);
  expect(silenceAfter('title', () => 0.5)).toBe(10);
  expect(silenceAfter('danger', () => 0.5)).toBeNull();
  expect(silenceAfter('siege', () => 0.5)).toBeNull();
  expect(silenceAfter('end', () => 0.5)).toBeNull();
});
