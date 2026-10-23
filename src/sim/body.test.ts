// H5 §2: partes del cuerpo, heridas, dolor (Salud) y lo que hacen piernas y brazos.
import { expect, test } from 'vitest';
import {
  BODY_HP,
  DOWNED_TICKS,
  FRESH_PAIN,
  FRESH_PAIN_HOURS,
  HIT_WEIGHTS,
  PAIN_PER_DAMAGE,
  SURVIVOR_WALK_SPEED,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  WOUNDS,
} from './balance';
import {
  addWound,
  armFactor,
  BODY_PARTS,
  knockDown,
  legFactor,
  partHp,
  refreshHealth,
} from './body';
import { willFight } from './danger';
import { healthSystem } from './health';
import { checkInvariants } from './invariants';
import { createRng } from './rng';
import { hitChance, workSpeed } from './skills';
import { walkStep } from './systems/movement';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import type { BodyPart, Survivor, World } from './types';
import { findWork } from './work';
import { zombieAttack } from './zombies/brain';
import { newZombie } from './zombies/spawn';

function world(): { w: World; s: Survivor } {
  const w = emptyWorld(30, 30);
  w.tick = TICKS_PER_DAY / 2;
  const s = w.survivors[0]!;
  s.pos = { x: 10.5, y: 10.5 };
  return { w, s };
}

test('seis partes con su vida; dónde caen los golpes; los tres tipos de herida', () => {
  expect(BODY_PARTS).toEqual(['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']);
  expect(BODY_HP).toEqual({
    head: 20,
    torso: 40,
    leftArm: 25,
    rightArm: 25,
    leftLeg: 25,
    rightLeg: 25,
  });
  expect(HIT_WEIGHTS).toEqual({
    head: 10,
    torso: 30,
    leftArm: 20,
    rightArm: 20,
    leftLeg: 10,
    rightLeg: 10,
  });
  // (Las cifras, tras el ajuste de la partida larga: balanceH5.test.ts.)
  expect(Object.keys(WOUNDS)).toEqual(['scratch', 'cut', 'bite']);
  expect([WOUNDS.scratch.damage, WOUNDS.cut.damage, WOUNDS.bite.damage]).toEqual([3, 6, 10]);
});

test('una herida quita vida a su parte (nunca por debajo de 0)', () => {
  const { w, s } = world();
  addWound(w, s, 'leftArm', 'cut');
  expect(partHp(s, 'leftArm')).toBe(19);
  expect(partHp(s, 'rightArm')).toBe(25);
  for (let i = 0; i < 5; i++) addWound(w, s, 'leftArm', 'bite');
  expect(partHp(s, 'leftArm')).toBe(0);
  expect(s.wounds[0]).toMatchObject({
    part: 'leftArm',
    kind: 'cut',
    size: 6,
    damage: 6,
    bleeding: true,
  });
});

test('dolor: daño × 1,5, el triple… bueno, ×2,5 al hacerse y ×1 a las 6 h; Salud = 100 − dolor', () => {
  expect([PAIN_PER_DAMAGE, FRESH_PAIN, FRESH_PAIN_HOURS]).toEqual([1.5, 2.5, 6]);
  const { w, s } = world();
  addWound(w, s, 'torso', 'cut');
  expect(s.health).toBeCloseTo(100 - 6 * 1.5 * 2.5);
  w.tick += 3 * TICKS_PER_HOUR;
  refreshHealth(w, s);
  expect(s.health).toBeCloseTo(100 - 6 * 1.5 * 1.75);
  w.tick += 3 * TICKS_PER_HOUR;
  refreshHealth(w, s);
  expect(s.health).toBeCloseTo(100 - 6 * 1.5);
  w.tick += 10 * TICKS_PER_HOUR;
  refreshHealth(w, s);
  expect(s.health).toBeCloseTo(100 - 6 * 1.5);
});

test('a 0 de Salud cae derribado; a las 4 h se levanta solo si su Salud ha vuelto a 15', () => {
  const { w, s } = world();
  for (let i = 0; i < 3; i++) addWound(w, s, 'torso', 'bite'); // 3 × 37,5 de dolor
  expect(s.health).toBe(0);
  expect(s.action.type).toBe('downed');
  expect(w.log.some((e) => e.kind === 'downed')).toBe(true);
  // A las 4 h el dolor ha bajado: 30 × 1,5 × 1,5 = 67,5 → Salud 32,5.
  w.tick += DOWNED_TICKS;
  healthSystem(w);
  expect(s.action.type).toBe('idle');
  // Con mucho más, a las 4 h sigue en el suelo.
  for (let i = 0; i < 4; i++) addWound(w, s, 'torso', 'bite');
  w.tick += DOWNED_TICKS;
  healthSystem(w);
  expect(s.action.type).toBe('downed');
});

test('knockDown: derriba (y saca del modo combate) sin herir', () => {
  const { w, s } = world();
  s.drafted = true;
  knockDown(w, s);
  expect(s.action.type).toBe('downed');
  expect(s.drafted).toBe(false);
  expect(s.wounds).toEqual([]);
});

/** Lo que deja un golpe de zombi que acierta, muchas veces. */
function hits(surrounded: boolean, health = 100, n = 2000) {
  const kinds = { scratch: 0, cut: 0, bite: 0 };
  const parts: Record<BodyPart, number> = {
    head: 0,
    torso: 0,
    leftArm: 0,
    rightArm: 0,
    leftLeg: 0,
    rightLeg: 0,
  };
  const { w, s } = world();
  w.zombieRng = createRng(7);
  const z = newZombie(w, { x: 11, y: 10 });
  w.zombies.push(z);
  if (surrounded) w.zombies.push(newZombie(w, { x: 9, y: 10 }));
  for (let i = 0; i < n; i++) {
    s.wounds = [];
    if (health < 100) addWound(w, s, 'leftLeg', 'cut'); // 4 cortes: 90 de dolor, Salud 10
    if (health < 100) for (let k = 0; k < 3; k++) addWound(w, s, 'rightLeg', 'cut');
    s.action = { type: 'idle', ticksLeft: 0 };
    const before = s.wounds.length;
    // Que acierte siempre: se repite hasta que deja herida.
    for (let t = 0; t < 100 && s.wounds.length === before; t++) zombieAttack(w, z, s);
    const wnd = s.wounds.at(-1)!;
    kinds[wnd.kind]++;
    parts[wnd.part]++;
  }
  return { kinds, parts };
}

test('golpes de zombi: solo, arañazos (85 %, ajuste) y el resto cortes, sin mordiscos', () => {
  const { kinds, parts } = hits(false);
  expect(kinds.bite).toBe(0);
  expect(kinds.scratch / 2000).toBeCloseTo(0.85, 1);
  expect(parts.torso / 2000).toBeCloseTo(0.3, 1);
  expect(parts.head / 2000).toBeCloseTo(0.1, 1);
});

test('rodeado (o muy herido, Salud bajo 30): 1 de cada 20, mordiscos (ajuste)', () => {
  expect(hits(true).kinds.bite / 2000).toBeCloseTo(0.05, 1);
  expect(hits(true).kinds.bite).toBeGreaterThan(40);
  expect(hits(false, 25).kinds.bite / 2000).toBeCloseTo(0.05, 1);
  expect(hits(false, 25).kinds.bite).toBeGreaterThan(40);
});

test('piernas: una a 0, la mitad de rápido; las dos, un cuarto; a medias, en proporción', () => {
  const { w, s } = world();
  const step = () => {
    s.pos = { x: 10.5, y: 10.5 };
    s.path = [{ x: 15, y: 10 }];
    walkStep(s, w.grid);
    return s.pos.x - 10.5;
  };
  expect(step()).toBeCloseTo(SURVIVOR_WALK_SPEED);
  addWound(w, s, 'leftLeg', 'cut'); // 19/25: le falta 0,24
  expect(legFactor(s)).toBeCloseTo(1 - 0.5 * 0.24);
  for (let i = 0; i < 3; i++) addWound(w, s, 'leftLeg', 'bite');
  expect(legFactor(s)).toBeCloseTo(0.5);
  expect(step()).toBeCloseTo(SURVIVOR_WALK_SPEED * 0.5);
  for (let i = 0; i < 3; i++) addWound(w, s, 'rightLeg', 'bite');
  expect(legFactor(s)).toBeCloseTo(0.25);
});

test('brazos: uno a 0, trabaja y acierta la mitad; los dos, ni trabaja ni pelea', () => {
  const { w, s } = world();
  const base = workSpeed(s, 'build');
  for (let i = 0; i < 3; i++) addWound(w, s, 'leftArm', 'bite');
  expect(armFactor(s)).toBeCloseTo(0.5);
  expect(workSpeed(s, 'build')).toBeCloseTo(base * 0.5);
  expect(hitChance(s.skills.fight.level, s)).toBeCloseTo(hitChance(s.skills.fight.level) * 0.5);
  for (let i = 0; i < 3; i++) addWound(w, s, 'rightArm', 'bite');
  expect(armFactor(s)).toBe(0);
  s.stance = 'fight';
  const z = newZombie(w, { x: 12, y: 10 });
  w.zombies.push(z);
  expect(willFight(w, s, [z])).toBe(false);
  w.zombies = [];
  w.blueprints.push({ id: 1, kind: 'woodWall', pos: { x: 3, y: 3 }, wood: 2, progress: 0 });
  expect(findWork(s, w)).toBeNull();
});

test('invariantes: cada herida en una parte que existe y con su daño entre 0 y su tamaño', () => {
  const { w, s } = world();
  addSurvivor(w, { x: 2, y: 2 });
  addWound(w, s, 'head', 'scratch');
  expect(checkInvariants(w)).toEqual([]);
  s.wounds[0]!.part = 'tail' as BodyPart;
  expect(checkInvariants(w).join()).toMatch(/herida .* en una parte que no existe/);
  s.wounds[0]!.part = 'head';
  s.wounds[0]!.damage = 7;
  expect(checkInvariants(w).join()).toMatch(/herida .*: daño 7 fuera de 0–3/);
});
