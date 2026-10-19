import { expect, test } from 'vitest';
import { parseSeed, randomSeed } from './seed';

const fb = () => 999;

test.each([
  ['?seed=12345', 12345],
  ['?seed=0', 0],
  ['?seed=4294967295', 4294967295],
  ['', 999],
  ['?seed=', 999],
  ['?seed=abc', 999],
  ['?seed=-5', 999],
  ['?seed=1.5', 999],
  ['?seed=4294967296', 999],
  ['?seed=1e5', 999],
  ['?seed=%2012', 999],
  ['?otro=1', 999],
  ['?otro=1&seed=7', 7],
])('parseSeed(%s) = %i', (q, esperado) => expect(parseSeed(q, fb)).toBe(esperado));

test('randomSeed da un entero de 32 bits sin signo', () => {
  for (let i = 0; i < 100; i++) {
    const s = randomSeed();
    expect(Number.isInteger(s) && s >= 0 && s <= 4294967295).toBe(true);
  }
});
