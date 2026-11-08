// V3 §6: el invierno: el huerto, la helada, la nieve, lo que se estropea y los zombis.
import { expect, test } from 'vitest';
import { RAIN_BARREL_LITERS, TICKS_PER_HOUR, ZOMBIE_COLD_SPEED, ZOMBIE_SPEED } from './balance';
import { dayStart } from './clock';
import { farmSystem, markPlot } from './farm';
import { outdoorTemp } from './season';
import { coldRot } from './spoil';
import { addBase, emptyWorld } from './testing/fixtures';
import type { World } from './types';
import { waterSystem } from './water';
import { zombieSpeed } from './zombies/system';

/** Pone la temperatura de fuera en `t` durante la próxima hora (con una «ola» a medida). */
function setTemp(w: World, t: number): void {
  w.common.tempShift = null;
  const base = outdoorTemp(w);
  w.common.tempShift = { value: t - base, until: w.tick + TICKS_PER_HOUR + 1 };
}

function garden(): World {
  const w = addBase(emptyWorld(12, 10), { x: 0, y: 0, w: 4, h: 4 });
  w.seen.fill(1);
  markPlot(w, 8, 6, true);
  w.plots[0]!.crop = { grown: 10, ripe: 0, dry: 0 };
  w.plots[0]!.moisture = 20;
  w.tick = dayStart(3) + 10 * TICKS_PER_HOUR;
  return w;
}

test('por debajo de 5 grados lo sembrado no crece (ni se seca)', () => {
  const w = garden();
  setTemp(w, 3);
  farmSystem(w);
  expect(w.plots[0]!.crop).toEqual({ grown: 10, ripe: 0, dry: 0 });
  setTemp(w, 12);
  farmSystem(w);
  expect(w.plots[0]!.crop!.grown).toBe(11);
});

test('una helada (por debajo de −2) mata lo que está creciendo, y el registro lo dice', () => {
  const w = garden();
  setTemp(w, -4);
  farmSystem(w);
  expect(w.plots[0]!.crop).toBeNull();
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'cropsFrozen', n: 1 });
});

test('nevando, el huerto no se moja y los depósitos se llenan la mitad', () => {
  const w = garden();
  w.plots[0]!.moisture = 0;
  w.furniture.push({ id: 80, kind: 'barrel', pos: { x: 10, y: 8 }, water: 0 });
  w.common.rainUntil = w.tick + 2 * TICKS_PER_HOUR;
  setTemp(w, -1);
  farmSystem(w);
  waterSystem(w);
  expect(w.plots[0]!.moisture).toBe(0);
  expect(w.furniture[0]!.water).toBe(RAIN_BARREL_LITERS / 2);
  setTemp(w, 4); // lloviendo de verdad
  farmSystem(w);
  waterSystem(w);
  expect(w.plots[0]!.moisture).toBeGreaterThan(0);
  expect(w.furniture[0]!.water).toBe(RAIN_BARREL_LITERS * 1.5);
});

test('con frío lo fresco se estropea menos: en pleno invierno, a la cuarta parte; en verano, igual', () => {
  const w = emptyWorld(3, 3);
  w.tick = dayStart(5);
  expect(coldRot(w)).toBe(1);
  w.tick = dayStart(37);
  expect(coldRot(w)).toBe(0.25);
});

test('helados, los zombis van un 20 % más despacio', () => {
  const w = emptyWorld(3, 3);
  w.tick = dayStart(5) + 12 * TICKS_PER_HOUR;
  expect(zombieSpeed(w)).toBe(ZOMBIE_SPEED);
  w.tick += 1;
  setTemp(w, -5);
  expect(zombieSpeed(w)).toBeCloseTo(ZOMBIE_SPEED * ZOMBIE_COLD_SPEED, 9);
});

test('ola de frío en otoño e invierno y de calor en verano: 8 grados, 2 días, una a la vez', async () => {
  const { coldSnapEvent, heatWaveEvent } = await import('./events/weatherWaves');
  const { TICKS_PER_DAY } = await import('./balance');
  const w = emptyWorld(3, 3);
  w.tick = dayStart(5);
  expect(coldSnapEvent.canHappen(w)).toBe(false);
  expect(heatWaveEvent.canHappen(w)).toBe(true);
  const before = outdoorTemp(w);
  heatWaveEvent.happen(w);
  expect(outdoorTemp(w)).toBeCloseTo(before + 8, 5);
  expect(heatWaveEvent.canHappen(w)).toBe(false); // ya hay una
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'heatWave' });
  w.tick = dayStart(20);
  expect(coldSnapEvent.canHappen(w)).toBe(true);
  coldSnapEvent.happen(w);
  expect(w.common.tempShift).toEqual({ value: -8, until: w.tick + 2 * TICKS_PER_DAY });
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'coldSnap' });
});
