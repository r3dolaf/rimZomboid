import { expect, test } from 'vitest';
import { createRng, nextFloat, nextInt, pick, type RngState } from './rng';

test('misma semilla, misma secuencia', () => {
  const a = createRng(42);
  const b = createRng(42);
  const sa = Array.from({ length: 5 }, () => nextFloat(a));
  const sb = Array.from({ length: 5 }, () => nextFloat(b));
  expect(sa).toEqual(sb);
});

test('semillas distintas, secuencias distintas', () => {
  expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
});

test('nextFloat siempre en [0,1)', () => {
  const r = createRng(7);
  for (let i = 0; i < 10_000; i++) {
    const v = nextFloat(r);
    expect(v >= 0 && v < 1).toBe(true);
  }
});

test('nextInt incluye ambos extremos y nada fuera', () => {
  const r = createRng(3);
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) seen.add(nextInt(r, 6, 10));
  expect([...seen].sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10]);
});

test('el estado sobrevive a JSON', () => {
  const r = createRng(9);
  nextFloat(r);
  const copia = JSON.parse(JSON.stringify(r)) as RngState;
  expect(nextFloat(copia)).toBe(nextFloat(r));
});

test('pick con lista vacía lanza error', () => {
  expect(() => pick(createRng(1), [])).toThrow();
});

test('pick devuelve un elemento de la lista', () => {
  const r = createRng(4);
  for (let i = 0; i < 100; i++) expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']));
});
