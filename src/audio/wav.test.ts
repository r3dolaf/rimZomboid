import { expect, test } from 'vitest';
import { encodeWav } from './wav';

test('un WAV de 16 bits con su cabecera y las muestras intercaladas', () => {
  const left = new Float32Array([0, 1, -1]);
  const right = new Float32Array([0.5, -0.5, 2]); // lo que se pasa de 1 se recorta
  const bytes = encodeWav([left, right], 44100);
  const v = new DataView(bytes.buffer);
  const text = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4));
  expect(text(0)).toBe('RIFF');
  expect(text(8)).toBe('WAVE');
  expect(text(36)).toBe('data');
  expect(v.getUint16(22, true)).toBe(2); // canales
  expect(v.getUint32(24, true)).toBe(44100);
  expect(v.getUint16(34, true)).toBe(16);
  expect(v.getUint32(40, true)).toBe(3 * 2 * 2);
  expect(bytes.length).toBe(44 + 12);
  const sample = (k: number) => v.getInt16(44 + k * 2, true);
  expect([sample(0), sample(1), sample(2), sample(3), sample(4), sample(5)]).toEqual([
    0, 16383, 32767, -16383, -32767, 32767,
  ]);
});
