import { expect, test } from 'vitest';
import { placeSound, type ListenerView } from './space';

// Se ven 40×20 casillas desde (100, 100): el centro es (120, 110).
const view: ListenerView = { x: 100, y: 100, w: 40, h: 20 };

test('en el centro, entero y en medio', () => {
  expect(placeSound({ x: 120, y: 110 }, view)).toEqual({ gain: 1, pan: 0 });
});

test('a la derecha del todo, a la derecha; a la izquierda, a la izquierda', () => {
  expect(placeSound({ x: 140, y: 110 }, view)!.pan).toBeCloseTo(0.7);
  expect(placeSound({ x: 100, y: 110 }, view)!.pan).toBeCloseTo(-0.7);
  expect(placeSound({ x: 300, y: 110 }, view)).toBeNull();
});

test('más lejos, más bajo; a una pantalla y media, nada', () => {
  const near = placeSound({ x: 130, y: 110 }, view)!.gain;
  const far = placeSound({ x: 150, y: 110 }, view)!.gain;
  expect(near).toBeLessThan(1);
  expect(far).toBeLessThan(near);
  expect(placeSound({ x: 120 + 60, y: 110 }, view)).toBeNull(); // 1,5 × 40
  expect(placeSound({ x: 120, y: 110 + 60 }, view)).toBeNull();
});

test('con más zoom (se ve menos), el mismo punto suena menos', () => {
  const zoomed: ListenerView = { x: 110, y: 105, w: 20, h: 10 };
  const at = { x: 135, y: 110 };
  expect(placeSound(at, zoomed)!.gain).toBeLessThan(placeSound(at, view)!.gain);
});
