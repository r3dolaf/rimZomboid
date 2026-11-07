import { expect, test } from 'vitest';
import { createLimiter, MAX_PER_FRAME, MAX_VOICES, SAME_GAP_MS } from './limit';

test('las cifras de la spec', () => {
  expect([SAME_GAP_MS, MAX_PER_FRAME, MAX_VOICES]).toEqual([70, 6, 16]);
});

test('el mismo efecto, no antes de 70 ms', () => {
  const l = createLimiter();
  expect(l.allow('chop', 1000, 0)).toBe(true);
  l.frame();
  expect(l.allow('chop', 1069, 0)).toBe(false);
  expect(l.allow('hurt', 1069, 0)).toBe(true);
  l.frame();
  expect(l.allow('chop', 1070, 0)).toBe(true);
});

test('como mucho 6 nuevos por fotograma', () => {
  const l = createLimiter();
  for (let k = 0; k < 6; k++) expect(l.allow(`s${k}`, 0, 0)).toBe(true);
  expect(l.allow('s6', 0, 0)).toBe(false);
  l.frame();
  expect(l.allow('s6', 0, 0)).toBe(true);
});

test('como mucho 16 a la vez', () => {
  const l = createLimiter();
  expect(l.allow('hurt', 0, 15)).toBe(true);
  expect(l.allow('bang', 0, 16)).toBe(false);
});

test('lo que no se deja no cuenta', () => {
  const l = createLimiter();
  expect(l.allow('bang', 0, 16)).toBe(false);
  expect(l.allow('bang', 10, 0)).toBe(true);
});
