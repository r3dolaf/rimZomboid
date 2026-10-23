// H5 §2.2 y §3: la sangre (sangrar, recuperarse, desnutrido, desmayo) y la curación de las heridas.
import { expect, test } from 'vitest';
import {
  BLOOD_REGEN,
  CLEAN_BANDAGE_HEAL,
  DOWNED_TICKS,
  FAINT_BELOW,
  FAINT_UNTIL,
  REST_HEAL,
  STARVING_BLOOD,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { addWound, refreshHealth } from './body';
import { healthSystem } from './health';
import { checkInvariants } from './invariants';
import { emptyWorld } from './testing/fixtures';
import type { Survivor, World } from './types';

function world(): { w: World; s: Survivor } {
  const w = emptyWorld(20, 20);
  w.tick = TICKS_PER_DAY / 2;
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  s.action = { type: 'idle', ticksLeft: 1e9 };
  return { w, s };
}

const hours = (w: World, h: number) => {
  for (let i = 0; i < h * TICKS_PER_HOUR; i++) {
    healthSystem(w);
    w.tick++;
  }
};

test('cifras: se recupera 2/4/6 por hora (ajuste); desnutrido −2; se desmaya bajo 30 y se levanta a 35', () => {
  expect(BLOOD_REGEN).toEqual({ awake: 2, rest: 4, hospital: 6 });
  expect([STARVING_BLOOD, FAINT_BELOW, FAINT_UNTIL]).toEqual([2, 30, 35]);
  expect([CLEAN_BANDAGE_HEAL, REST_HEAL]).toEqual([2, 2]);
  expect(world().s.blood).toBe(100);
});

test('sangrar: un corte, 4 por hora; un mordisco, 5 (ajuste); se suman', () => {
  const { w, s } = world();
  addWound(w, s, 'leftArm', 'cut');
  hours(w, 1);
  expect(s.blood).toBeCloseTo(96, 5);
  addWound(w, s, 'rightArm', 'bite');
  hours(w, 1);
  expect(s.blood).toBeCloseTo(87, 5);
});

test('un arañazo sangra 2 por hora y para solo a la hora; luego se recupera (2 por hora)', () => {
  const { w, s } = world();
  const wd = addWound(w, s, 'torso', 'scratch');
  hours(w, 1);
  expect(s.blood).toBeCloseTo(98, 5);
  expect(wd.bleeding).toBe(false);
  s.blood = 90;
  hours(w, 1);
  expect(s.blood).toBeCloseTo(92, 5);
});

test('recuperarse: 2 por hora despierto, 4 durmiendo; nunca pasa de 100', () => {
  const { w, s } = world();
  s.blood = 50;
  hours(w, 2);
  expect(s.blood).toBeCloseTo(54, 5);
  s.action = { type: 'sleep', inBed: false };
  s.needs.sleep = 0;
  hours(w, 2);
  expect(s.blood).toBeCloseTo(62, 5);
  s.blood = 99.9;
  hours(w, 1);
  expect(s.blood).toBe(100);
});

test('desnutrido (hambre a 0): pierde 2 por hora y no se recupera', () => {
  const { w, s } = world();
  s.needs.hunger = 0;
  hours(w, 3);
  expect(s.blood).toBeCloseTo(94, 5);
});

test('por debajo de 30 se desmaya; no se levanta hasta volver a 35', () => {
  const { w, s } = world();
  s.blood = 30.05;
  addWound(w, s, 'leftLeg', 'cut'); // 5 por hora
  for (let i = 0; i < 20; i++) {
    healthSystem(w);
    w.tick++;
  }
  expect(s.blood).toBeLessThan(FAINT_BELOW);
  expect(s.action.type).toBe('downed');
  s.wounds[0]!.bleeding = false; // ya no sangra: se recupera a 1 por hora (2 en el suelo no cuenta)
  w.tick += DOWNED_TICKS;
  healthSystem(w);
  expect(s.action.type).toBe('downed'); // con 30, aún no
  s.blood = FAINT_UNTIL;
  healthSystem(w);
  expect(s.action.type).toBe('idle');
});

test('a 0 de Sangre, muere (desangrado; o de hambre si no sangraba); cabeza o torso a 0, por los golpes', () => {
  const a = world();
  a.s.blood = 0.01;
  addWound(a.w, a.s, 'leftLeg', 'cut');
  healthSystem(a.w);
  expect(a.s.dying).toBe('blood');
  const b = world();
  b.s.blood = 0.005;
  b.s.needs.hunger = 0;
  healthSystem(b.w);
  expect(b.s.dying).toBe('hunger');
  const c = world();
  for (let i = 0; i < 2; i++) addWound(c.w, c.s, 'head', 'bite');
  healthSystem(c.w);
  expect(c.s.dying).toBe('wounds');
});

test('curarse: un arañazo en 1 día, un corte en 3; con venda limpia el doble; durmiendo también', () => {
  const { w, s } = world();
  const scratch = addWound(w, s, 'leftArm', 'scratch');
  const cut = addWound(w, s, 'rightArm', 'cut');
  cut.bleeding = false;
  hours(w, 12);
  expect(scratch.damage).toBeCloseTo(1.5, 5);
  expect(cut.damage).toBeCloseTo(5, 5);
  hours(w, 12);
  expect(s.wounds).not.toContain(scratch); // curado: desaparece
  cut.cleanUntil = w.tick + 1e9; // vendado
  hours(w, 6);
  expect(cut.damage).toBeCloseTo(4 - ((6 * 2) / 72) * 6, 5);
  s.action = { type: 'sleep', inBed: true };
  s.needs.sleep = 0;
  const before = cut.damage;
  hours(w, 6);
  expect(before - cut.damage).toBeCloseTo((6 * 2 * 2 * 6) / 72, 5);
});

test('al curarse, duele menos: la Salud sube', () => {
  const { w, s } = world();
  addWound(w, s, 'torso', 'cut').bleeding = false;
  hours(w, 6);
  refreshHealth(w, s);
  const h = s.health;
  hours(w, 12);
  expect(s.health).toBeGreaterThan(h);
});

test('invariante: Sangre entre 0 y 100', () => {
  const { w, s } = world();
  expect(checkInvariants(w)).toEqual([]);
  s.blood = 101;
  expect(checkInvariants(w).join()).toMatch(/Sangre fuera de 0–100/);
});
