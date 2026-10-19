import { expect, test, vi } from 'vitest';
import { createWorld } from '../sim/world';
import { runTicks } from './runTicks';

test('sin comprobación, ejecuta todos los ticks', () => {
  const w = createWorld(1);
  runTicks(w, 50);
  expect(w.tick).toBe(50);
});

test('con comprobación y un mundo sano, no avisa', () => {
  const w = createWorld(1);
  const onProblems = vi.fn();
  runTicks(w, 100, onProblems);
  expect(w.tick).toBe(100);
  expect(onProblems).not.toHaveBeenCalled();
});

test('avisa en cuanto se rompe una invariante y se detiene para conservar el estado', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos.x = NaN;
  const onProblems = vi.fn();
  runTicks(w, 100, onProblems);
  expect(onProblems).toHaveBeenCalledTimes(1);
  expect(onProblems.mock.calls[0]![0]).toHaveLength(1);
  expect(w.tick).toBe(1);
});
