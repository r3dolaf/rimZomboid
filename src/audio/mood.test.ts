import { expect, test } from 'vitest';
import { createMoodPicker, DANGER_HOLD_MS, switchNow, type MoodInput } from './mood';

const calm: MoodInput = {
  title: false,
  over: false,
  siege: false,
  zombiesSeen: 0,
  darkness: 0,
  now: 0,
};

test('la portada', () => {
  expect(createMoodPicker().pick({ ...calm, title: true })).toBe('title');
});

test('de día, day; desde media oscuridad, night', () => {
  const p = createMoodPicker();
  expect(p.pick({ ...calm, darkness: 0.49 })).toBe('day');
  expect(p.pick({ ...calm, darkness: 0.5 })).toBe('night');
});

test('el final manda sobre todo', () => {
  const p = createMoodPicker();
  expect(p.pick({ ...calm, over: true, siege: true, zombiesSeen: 4, darkness: 1 })).toBe('end');
});

test('el asedio manda sobre el peligro', () => {
  expect(createMoodPicker().pick({ ...calm, siege: true, zombiesSeen: 3 })).toBe('siege');
});

test('con zombis a la vista, danger, y aguanta 20 s', () => {
  expect(DANGER_HOLD_MS).toBe(20_000);
  const p = createMoodPicker();
  expect(p.pick({ ...calm, zombiesSeen: 1, now: 1000 })).toBe('danger');
  expect(p.pick({ ...calm, now: 1000 + 19_900 })).toBe('danger');
  expect(p.pick({ ...calm, now: 1000 + 20_000 })).toBe('day');
});

test('día y noche no cortan el tema; lo demás sí', () => {
  expect(switchNow('day', 'night')).toBe(false);
  expect(switchNow('night', 'day')).toBe(false);
  expect(switchNow('day', 'day')).toBe(false);
  expect(switchNow('day', 'danger')).toBe(true);
  expect(switchNow('danger', 'day')).toBe(true);
  expect(switchNow('title', 'day')).toBe(true);
  expect(switchNow(null, 'day')).toBe(true);
});
