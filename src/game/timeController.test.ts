import { expect, test } from 'vitest';
import { TICKS_PER_SECOND } from '../sim/balance';
import { createTimeController, MS_PER_TICK, SLEEP_SPEED } from './timeController';

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

// Con todos durmiendo, el tiempo va solo a x6 (hasta que alguien despierte o elijas otra velocidad).
test('todos durmiendo: va a x6 sin cambiar la velocidad elegida; al despertar, vuelve', () => {
  const t = createTimeController();
  expect(SLEEP_SPEED).toBe(6);
  t.setAllAsleep(true);
  expect(t.boosted).toBe(true);
  expect(t.advance(100)).toBe(6);
  expect(t.speed).toBe(1);
  t.setAllAsleep(false);
  expect(t.boosted).toBe(false);
  expect(t.advance(100)).toBe(1);
});

test('durmiendo, elegir una velocidad manda hasta la noche siguiente', () => {
  const t = createTimeController();
  t.setAllAsleep(true);
  t.setSpeed(2);
  expect(t.boosted).toBe(false);
  expect(t.advance(100)).toBe(2);
  t.setAllAsleep(true); // (se sigue avisando en cada fotograma)
  expect(t.boosted).toBe(false);
  t.setAllAsleep(false);
  t.setAllAsleep(true);
  expect(t.boosted).toBe(true);
});

test('la pausa no quita el x6: al reanudar sigue; dormirse en pausa no avanza', () => {
  const t = createTimeController();
  t.setAllAsleep(true);
  t.togglePause();
  expect(t.boosted).toBe(false);
  expect(t.advance(1000)).toBe(0);
  t.togglePause();
  expect(t.boosted).toBe(true);
  expect(t.advance(100)).toBe(6);
  t.setAllAsleep(false);
  t.setSpeed(0);
  t.setAllAsleep(true);
  expect(t.advance(1000)).toBe(0);
});

test('a x6, un dt enorme también se limita', () => {
  const t = createTimeController();
  t.setAllAsleep(true);
  expect(t.advance(5 * 60_000)).toBe(15); // floor(250 * 6 / 100)
});
