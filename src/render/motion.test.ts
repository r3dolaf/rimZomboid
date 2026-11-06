// A5: lo que se mueve al andar, al golpear y al trabajar.
import { expect, test } from 'vitest';
import {
  DECAL_TICKS,
  decalAlpha,
  fallAngle,
  FALL_MS,
  lungeAmount,
  LUNGE_MS,
  LUNGE_PX,
  stepParticles,
  STEP_TILES,
  walkStep,
  type Particle,
} from './motion';

test('al andar se alternan los dos pasos con el de pie entre medias; quieto, de pie', () => {
  const steps = [0, 1, 2, 3, 4].map((k) => walkStep(k * STEP_TILES + 0.01, true));
  expect(steps).toEqual(['A', null, 'B', null, 'A']);
  expect(walkStep(0.01, false)).toBeNull();
});

const drop = (over: Partial<Particle> = {}): Particle => ({
  x: 0,
  y: 0,
  z: 5,
  vx: 0.01,
  vy: 0,
  vz: 0.05,
  life: 1000,
  color: 0,
  size: 1,
  ...over,
});

test('lo que salta sube, cae hasta el suelo y allí se queda quieto hasta acabarse', () => {
  const ps = [drop()];
  stepParticles(ps, 16);
  expect(ps[0]!.z).toBeGreaterThan(5);
  for (let k = 0; k < 60; k++) stepParticles(ps, 16);
  expect(ps[0]!.z).toBe(0);
  const x = ps[0]!.x;
  stepParticles(ps, 16);
  expect(ps[0]!.x).toBe(x);
  stepParticles(ps, 1000);
  expect(ps).toHaveLength(0);
});

test('el polvo no cae: sube despacio', () => {
  const ps = [drop({ floats: true, vz: 0.01 })];
  stepParticles(ps, 100);
  expect(ps[0]!.z).toBeCloseTo(6, 5);
});

test('las manchas se secan: enteras medio día y del todo al día', () => {
  expect(decalAlpha(0)).toBe(1);
  expect(decalAlpha(DECAL_TICKS / 2)).toBe(1);
  expect(decalAlpha((DECAL_TICKS * 3) / 4)).toBeCloseTo(0.5, 5);
  expect(decalAlpha(DECAL_TICKS)).toBe(0);
  expect(decalAlpha(DECAL_TICKS * 2)).toBe(0);
});

test('un árbol cae cada vez más deprisa hasta quedar tumbado', () => {
  expect(fallAngle(0)).toBe(0);
  expect(fallAngle(FALL_MS)).toBeCloseTo(Math.PI / 2, 5);
  expect(fallAngle(FALL_MS * 2)).toBeCloseTo(Math.PI / 2, 5);
  expect(fallAngle(FALL_MS / 2)).toBeLessThan(Math.PI / 4);
});

test('quien golpea se lanza un poco y vuelve', () => {
  expect(lungeAmount(0)).toBe(0);
  expect(lungeAmount(LUNGE_MS / 2)).toBeCloseTo(LUNGE_PX, 5);
  expect(lungeAmount(LUNGE_MS)).toBe(0);
  expect(lungeAmount(-5)).toBe(0);
});
