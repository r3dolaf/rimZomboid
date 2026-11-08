// V3 §1–§2: el calendario y la temperatura.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import { dayStart } from './clock';
import {
  dayMean,
  outdoorTemp,
  seasonOf,
  seasonStarts,
  seasonSystem,
  tempAt,
  yearMean,
} from './season';
import { addBase, emptyWorld } from './testing/fixtures';

const day = (d: number, hour = 12) => dayStart(d) + hour * TICKS_PER_HOUR;

test('un año de 60 días: verano, otoño (día 16), invierno (31) y primavera (46)', () => {
  expect(seasonOf(day(1))).toBe('summer');
  expect(seasonOf(day(15, 23))).toBe('summer');
  expect(seasonOf(day(16))).toBe('autumn');
  expect(seasonOf(day(31))).toBe('winter');
  expect(seasonOf(day(46))).toBe('spring');
  expect(seasonOf(day(61))).toBe('summer');
  expect(seasonStarts(dayStart(16))).toBe('autumn');
  expect(seasonStarts(dayStart(16) + 1)).toBeNull();
  expect(seasonStarts(0)).toBeNull(); // la primera no se anuncia
});

test('la media del año: unos 24 en pleno verano, 11 en otoño y −2 en pleno invierno', () => {
  expect(yearMean(7.5)).toBeCloseTo(24, 5);
  expect(yearMean(22.5)).toBeCloseTo(11, 5);
  expect(yearMean(37.5)).toBeCloseTo(-2, 5);
});

test('a lo largo del día: más frío de madrugada y más calor por la tarde; igual con la misma semilla', () => {
  const w = emptyWorld(3, 3);
  const dawn = outdoorTemp(w, day(5, 3));
  const afternoon = outdoorTemp(w, day(5, 15));
  expect(afternoon - dawn).toBeGreaterThan(6);
  expect(outdoorTemp(emptyWorld(3, 3), day(5, 15))).toBe(afternoon);
  // Cada día se aparta de la media como mucho 4 grados.
  for (let d = 1; d <= 60; d++)
    expect(Math.abs(dayMean(w, day(d)) - yearMean(d - 0.5))).toBeLessThanOrEqual(4.01);
  // Sin saltos a medianoche.
  expect(Math.abs(outdoorTemp(w, dayStart(9)) - outdoorTemp(w, dayStart(9) - 1))).toBeLessThan(0.1);
});

test('la lluvia resta 3; la tormenta, 5; una ola, lo suyo', () => {
  const w = emptyWorld(3, 3);
  w.tick = day(3);
  const dry = outdoorTemp(w);
  w.common.rainUntil = w.tick + 1;
  expect(outdoorTemp(w)).toBeCloseTo(dry - 3, 5);
  w.common.stormUntil = w.tick + 1;
  expect(outdoorTemp(w)).toBeCloseTo(dry - 5, 5);
  w.common.rainUntil = 0;
  w.common.stormUntil = 0;
  w.common.tempShift = { value: -8, until: w.tick + 1 };
  expect(outdoorTemp(w)).toBeCloseTo(dry - 8, 5);
  expect(outdoorTemp(w, w.tick + 1)).not.toBeCloseTo(dry - 8, 1); // ya pasó
});

test('bajo techo se acerca a 20 (hasta 8 más, hasta 4 menos); junto a una hoguera encendida, 12 más', () => {
  const w = addBase(emptyWorld(20, 12), { x: 0, y: 0, w: 8, h: 8 });
  expect(tempAt(w, { x: 3, y: 3 }, 0)).toBe(8);
  expect(tempAt(w, { x: 3, y: 3 }, 15)).toBe(20);
  expect(tempAt(w, { x: 3, y: 3 }, 30)).toBe(26);
  expect(tempAt(w, { x: 15, y: 10 }, 0)).toBe(0);
  w.furniture.push({ id: 80, kind: 'campfire', pos: { x: 14, y: 10 }, fuel: 5 });
  expect(tempAt(w, { x: 15, y: 10 }, 0)).toBe(12);
  w.furniture[0]!.fuel = 0; // apagada
  expect(tempAt(w, { x: 15, y: 10 }, 0)).toBe(0);
});

test('al empezar el otoño, el registro lo dice', () => {
  const w = emptyWorld(3, 3);
  w.tick = dayStart(16);
  seasonSystem(w);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'season', season: 'autumn' });
  w.tick += TICKS_PER_DAY / 2;
  seasonSystem(w);
  expect(w.common.log).toHaveLength(1);
});
