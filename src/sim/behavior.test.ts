// Comportamiento de los supervivientes (H2): comer, dormir, crisis.
import { expect, test } from 'vitest';
import { CRISIS_TICKS, EAT_TICKS, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import { brains } from './brain';
import { moodModifiers } from './mood';
import { step } from './step';
import { activitiesSystem } from './systems/activities';
import { decisionsSystem } from './systems/decisions';
import type { Action, Survivor, World } from './types';
import { createWorld, tileOf } from './world';

/** Tick de una hora del día 1 (la partida empieza a las 08:00). */
const at = (hour: number) => ((hour - 8 + 24) % 24) * TICKS_PER_HOUR;

function runUntil(w: World, cond: () => boolean, max: number): boolean {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    step(w);
  }
  return cond();
}

function rested(s: Survivor) {
  s.needs.hunger = 100;
  s.needs.sleep = 100;
}

test('con hambre baja va al almacén y come: −1 lata, +60 de hambre y "Comió"', () => {
  const w = createWorld(3);
  w.survivors.forEach(rested);
  const s = w.survivors[0]!;
  s.needs.hunger = 30;
  expect(runUntil(w, () => w.storage.food === 34, 2 * TICKS_PER_HOUR)).toBe(true);
  expect(s.needs.hunger).toBeGreaterThan(85);
  expect(s.memories.some((m) => m.id === 'ate')).toBe(true);
  expect(w.storage.tiles).toContainEqual(tileOf(s.pos));
});

test('sin comida en el almacén no va a comer', () => {
  const w = createWorld(3);
  const s = w.survivors[0]!;
  rested(s);
  s.needs.hunger = 30;
  w.storage.food = 0;
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'eat').toBe(false);
});

test('si dos se comen la última lata a la vez, la comida queda en 0 y solo uno come', () => {
  const w = createWorld(3);
  const [a, b] = w.survivors;
  a!.needs.hunger = 10;
  b!.needs.hunger = 10;
  w.storage.food = 1;
  a!.action = { type: 'eat', ticksLeft: 1 };
  b!.action = { type: 'eat', ticksLeft: 1 };
  activitiesSystem(w);
  expect(w.storage.food).toBe(0);
  expect([a!.needs.hunger, b!.needs.hunger].sort((x, y) => x - y)).toEqual([10, 70]);
  expect(a!.action.type).toBe('idle');
  expect(b!.action.type).toBe('idle');
});

test('comer dura EAT_TICKS', () => {
  const w = createWorld(3);
  const s = w.survivors[0]!;
  s.action = { type: 'eat', ticksLeft: EAT_TICKS };
  for (let i = 0; i < EAT_TICKS - 1; i++) activitiesSystem(w);
  expect(s.action.type).toBe('eat');
  activitiesSystem(w);
  expect(s.action.type).toBe('idle');
});

test('de noche, con sueño bajo, va a su cama y duerme en ella', () => {
  const w = createWorld(3);
  w.tick = at(22);
  const s = w.survivors[0]!;
  rested(s);
  s.needs.sleep = 40;
  expect(runUntil(w, () => s.action.type === 'sleep', TICKS_PER_HOUR)).toBe(true);
  const bed = w.beds.find((b) => b.id === s.bedId)!;
  expect(tileOf(s.pos)).toEqual(bed.pos);
  expect(s.action).toEqual({ type: 'sleep', inBed: true });
});

test('no se despierta de noche; a partir de las 06:00, con el sueño lleno, sí', () => {
  const w = createWorld(3);
  w.tick = at(2);
  const s = w.survivors[0]!;
  s.needs.sleep = 100;
  s.action = { type: 'sleep', inBed: true };
  activitiesSystem(w);
  expect(s.action.type).toBe('sleep');
  w.tick = at(6);
  activitiesSystem(w);
  expect(s.action.type).toBe('idle');
  expect(s.memories.map((m) => m.id)).toContain('sleptInBed');
});

test('una siesta de día termina al llenarse el sueño, con "Durmió en el suelo" si no fue en cama', () => {
  const w = createWorld(3);
  w.tick = at(14);
  const s = w.survivors[0]!;
  s.needs.sleep = 100;
  s.action = { type: 'sleep', inBed: false };
  activitiesSystem(w);
  expect(s.action.type).toBe('idle');
  expect(s.memories.map((m) => m.id)).toContain('sleptOnFloor');
});

test('si el sueño llega a 0, se desploma donde esté, aunque vaya andando', () => {
  const w = createWorld(3);
  const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 0, y: 0 } };
  s.path = [{ x: 1, y: 1 }];
  s.needs.sleep = 0;
  decisionsSystem(w);
  expect(s.action).toEqual({ type: 'sleep', inBed: false });
  expect(s.path).toEqual([]);
});

test('con ánimo por debajo de 10 entra en crisis 4 h y después se desahoga', () => {
  const w = createWorld(3);
  w.tick = at(9);
  w.survivors.forEach(rested);
  const s = w.survivors[0]!;
  s.needs.mood = 5;
  expect(runUntil(w, () => s.action.type === 'crisis', TICKS_PER_HOUR)).toBe(true);
  expect(runUntil(w, () => s.action.type !== 'crisis', CRISIS_TICKS + 5)).toBe(true);
  expect(s.memories.map((m) => m.id)).toContain('vented');
});

test('la crisis se interrumpe si el sueño baja de 10', () => {
  const w = createWorld(3);
  const s = w.survivors[0]!;
  s.action = { type: 'crisis', ticksLeft: 100 };
  s.needs.sleep = 5;
  decisionsSystem(w);
  const a = s.action as Action; // TS no sabe que decisionsSystem la ha cambiado
  expect(a.type === 'moveTo' && a.then?.type === 'sleep').toBe(true);
});

test('escenario: a las 23:00 del día 1 los tres duermen en su cama', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const w = createWorld(seed);
    runUntil(w, () => false, at(23));
    for (const s of w.survivors)
      expect(s.action, `semilla ${seed}: ${s.name}`).toEqual({ type: 'sleep', inBed: true });
  }
});

test('escenario: con el almacén vacío, a los 2 días todos están desnutridos', () => {
  const w = createWorld(7);
  w.storage.food = 0;
  runUntil(w, () => false, 2 * TICKS_PER_DAY);
  for (const s of w.survivors)
    expect(moodModifiers(s, w.tick).map((m) => m.id)).toContain('starving');
});
