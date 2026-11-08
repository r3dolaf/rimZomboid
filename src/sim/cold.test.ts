// V3 §3: el abrigo, la sensación térmica y el frío.
import { expect, test } from 'vitest';
import {
  COLD_MOOD,
  FREEZING_BLOOD,
  FREEZING_MOOD,
  HOT_MOOD,
  THIRST_PER_DAY,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { bloodTick } from './blood';
import { brains } from './brain';
import { dayStart } from './clock';
import { moodModifiers } from './mood';
import { feelsSystem, outdoorTemp, warmthOf } from './season';
import { needsSystem } from './systems/needs';
import { addBase, emptyWorld } from './testing/fixtures';
import type { Garment } from './types';

const garment = (kind: Garment['kind'], holes: Garment['holes'] = []): Garment => ({
  id: 1,
  kind,
  holes,
  patches: {},
  pads: {},
  dirtHours: 0,
  bloody: false,
  from: null,
});

test('cada prenda abriga lo suyo y cada agujero le quita un 20 %', () => {
  expect(warmthOf([garment('coat'), garment('jeans')])).toBeCloseTo(11, 9);
  expect(warmthOf([garment('coat', ['torso', 'leftArm'])])).toBeCloseTo(9 * 0.6, 9);
  expect(warmthOf([])).toBe(0);
});

test('la sensación térmica: la temperatura de donde está más su ropa; bajo techo, más templado', () => {
  const w = addBase(emptyWorld(20, 12), { x: 0, y: 0, w: 8, h: 8 });
  const s = w.survivors[0]!;
  s.worn = [garment('tshirt'), garment('jeans')];
  w.tick = dayStart(36) + 3 * TICKS_PER_HOUR; // pleno invierno, de madrugada
  s.pos = { x: 15.5, y: 10.5 };
  feelsSystem(w);
  const out = outdoorTemp(w);
  expect(s.feels).toBeCloseTo(out + 3, 5);
  s.pos = { x: 3.5, y: 3.5 };
  feelsSystem(w);
  expect(s.feels).toBeGreaterThan(out + 3);
});

test('frío, helado y calor en el ánimo', () => {
  const s = emptyWorld(3, 3).survivors[0]!;
  s.feels = 5;
  expect(moodModifiers(s, 0)).toContainEqual({ id: 'cold', value: COLD_MOOD });
  s.feels = -3;
  expect(moodModifiers(s, 0)).toContainEqual({ id: 'freezing', value: FREEZING_MOOD });
  s.feels = 40;
  expect(moodModifiers(s, 0)).toContainEqual({ id: 'hot', value: HOT_MOOD });
  s.feels = 20;
  expect(moodModifiers(s, 0).some((m) => ['cold', 'freezing', 'hot'].includes(m.id))).toBe(false);
});

test('helado pierde 3 de sangre por hora y puede morir de frío', () => {
  const w = emptyWorld(3, 3);
  const s = w.survivors[0]!;
  s.feels = -5;
  s.blood = 50;
  for (let i = 0; i < TICKS_PER_HOUR; i++) bloodTick(w, s);
  expect(s.blood).toBeCloseTo(50 - FREEZING_BLOOD, 5);
  s.blood = 0.001;
  bloodTick(w, s);
  expect(s.dying).toBe('cold');
});

test('con calor la sed baja una vez y media más rápido', () => {
  const w = emptyWorld(3, 3);
  const s = w.survivors[0]!;
  s.feels = 40;
  for (let i = 0; i < TICKS_PER_DAY / 10; i++) needsSystem(w);
  expect(s.needs.thirst).toBeCloseTo(100 - (THIRST_PER_DAY / 10) * 1.5, 5);
});

test('helado fuera, va a calentarse junto a una hoguera encendida o, si no hay, a la base', () => {
  const w = addBase(emptyWorld(20, 12), { x: 0, y: 0, w: 8, h: 8 });
  w.seen.fill(1);
  const s = w.survivors[0]!;
  s.pos = { x: 15.5, y: 10.5 };
  s.feels = -4;
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type).toBe('warmUp');
  if (a?.type === 'moveTo') expect(a.target.x).toBeLessThan(8); // a la base
  w.furniture.push({ id: 80, kind: 'campfire', pos: { x: 17, y: 6 }, fuel: 6 });
  const b = brains.ai.decide(s, w);
  expect(b?.type === 'moveTo' && b.target.x).toBeGreaterThanOrEqual(16); // junto al fuego
  s.pos = { x: 17.5, y: 7.5 }; // ya junto a ella: nada
  expect(
    brains.ai.decide(s, w)?.type === 'moveTo' &&
      (brains.ai.decide(s, w) as { then?: { type: string } }).then?.type,
  ).not.toBe('warmUp');
});

test('al vestirse con frío cuenta el abrigo: en pleno invierno cambia la chaqueta de cuero por el abrigo; en verano, no', async () => {
  const { startDress, warmthValue } = await import('./jobs/dress');
  const setup = (tick: number) => {
    const w = emptyWorld(4, 4);
    const s = w.survivors[0]!;
    s.worn = [
      { ...garment('leatherJacket'), id: 501 },
      { ...garment('jeans'), id: 502 },
    ];
    w.storage.items.pieces = [{ ...garment('coat'), id: 503 }];
    s.pos = { x: 0.5, y: 3.5 };
    w.tick = tick;
    return { w, s };
  };
  const summer = setup(dayStart(5) + 12 * TICKS_PER_HOUR);
  expect(warmthValue(summer.w)).toBe(0);
  startDress(summer.s, summer.w);
  expect(summer.s.worn.map((g) => g.kind)).toContain('leatherJacket');
  const winter = setup(dayStart(37) + 12 * TICKS_PER_HOUR);
  expect(warmthValue(winter.w)).toBeGreaterThan(3);
  startDress(winter.s, winter.w);
  expect(winter.s.worn.map((g) => g.kind)).toContain('coat');
  expect(winter.w.storage.items.pieces.map((g) => g.kind)).toContain('leatherJacket');
});
