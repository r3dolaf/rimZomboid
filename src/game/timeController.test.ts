import { expect, test } from 'vitest';
import { TICKS_PER_SECOND } from '../sim/balance';
import { createTimeController, MS_PER_TICK } from './timeController';

test('empieza a x1', () => expect(createTimeController().speed).toBe(1));

test('a x1, 100 ms son 1 tick', () => {
  expect(createTimeController().advance(100)).toBe(1);
});

test('a x3, 100 ms son 3 ticks', () => {
  const t = createTimeController();
  t.setSpeed(3);
  expect(t.advance(100)).toBe(3);
});

test('acumula fracciones', () => {
  const t = createTimeController();
  expect(t.advance(60)).toBe(0);
  expect(t.advance(60)).toBe(1);
});

test('en pausa no avanza', () => {
  const t = createTimeController();
  t.setSpeed(0);
  expect(t.advance(1000)).toBe(0);
});

test('togglePause recuerda la última velocidad', () => {
  const t = createTimeController();
  t.setSpeed(2);
  t.togglePause();
  expect(t.speed).toBe(0);
  t.togglePause();
  expect(t.speed).toBe(2);
});

test('togglePause desde el inicio vuelve a x1', () => {
  const t = createTimeController();
  t.togglePause();
  t.togglePause();
  expect(t.speed).toBe(1);
});

test('un dt enorme (pestaña en segundo plano) se limita', () => {
  const t = createTimeController();
  t.setSpeed(3);
  expect(t.advance(5 * 60_000)).toBe(7); // floor(250 * 3 / 100)
});

test('un dt negativo o NaN no avanza ni rompe el acumulador', () => {
  const t = createTimeController();
  expect(t.advance(-50)).toBe(0);
  expect(t.advance(NaN)).toBe(0);
  expect(t.advance(100)).toBe(1);
});

test('togglePause funciona como callback suelto', () => {
  const t = createTimeController();
  const { togglePause } = t;
  togglePause();
  expect(t.speed).toBe(0);
});

test('MS_PER_TICK sale de TICKS_PER_SECOND', () => {
  expect(MS_PER_TICK).toBe(1000 / TICKS_PER_SECOND);
});
