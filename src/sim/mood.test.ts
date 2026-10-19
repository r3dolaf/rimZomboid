import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from './balance';
import { addMemory, moodModifiers, moodTarget } from './mood';
import { moodSystem } from './systems/mood';
import { emptyWorld } from './testing/fixtures';
import type { Survivor } from './types';
import { createWorld } from './world';

const survivor = (): Survivor => emptyWorld(3, 3).survivors[0]!;

test('sin nada especial, el objetivo es 50', () => {
  expect(moodModifiers(survivor(), 0)).toEqual([]);
  expect(moodTarget(survivor(), 0)).toBe(50);
});

test('Hambriento −10 por debajo de 25; Desnutrido −25 a 0, sin sumarse', () => {
  const s = survivor();
  s.needs.hunger = 20;
  expect(moodModifiers(s, 0)).toEqual([{ id: 'hungry', value: -10 }]);
  s.needs.hunger = 0;
  expect(moodModifiers(s, 0)).toEqual([{ id: 'starving', value: -25 }]);
});

test('Cansado −10 por debajo de 20', () => {
  const s = survivor();
  s.needs.sleep = 19;
  expect(moodTarget(s, 0)).toBe(40);
});

test('Optimista +10 y Pesimista −10', () => {
  const s = survivor();
  s.traits = ['optimist'];
  expect(moodTarget(s, 0)).toBe(60);
  s.traits = ['pessimist', 'glutton'];
  expect(moodTarget(s, 0)).toBe(40);
});

test('los recuerdos suman con su caducidad y dejan de contar al caducar', () => {
  const s = survivor();
  addMemory(s, 'sleptInBed', 0);
  addMemory(s, 'ate', 0);
  expect(moodModifiers(s, 0)).toEqual([
    { id: 'sleptInBed', value: 5, expiresAt: 12 * TICKS_PER_HOUR },
    { id: 'ate', value: 5, expiresAt: 6 * TICKS_PER_HOUR },
  ]);
  expect(moodTarget(s, 0)).toBe(60);
  expect(moodTarget(s, 6 * TICKS_PER_HOUR)).toBe(55); // "Comió" ya caducó
});

test('un recuerdo nuevo sustituye a otro del mismo tipo', () => {
  const s = survivor();
  addMemory(s, 'ate', 0);
  addMemory(s, 'ate', 100);
  expect(s.memories).toEqual([{ id: 'ate', expiresAt: 100 + 6 * TICKS_PER_HOUR }]);
});

test('Durmió en el suelo −5 y Se desahogó +15', () => {
  const s = survivor();
  addMemory(s, 'sleptOnFloor', 0);
  addMemory(s, 'vented', 0);
  expect(moodTarget(s, 0)).toBe(60);
});

test('el objetivo no sale de 0–100', () => {
  const s = survivor();
  s.needs.hunger = 0;
  s.needs.sleep = 0;
  s.traits = ['pessimist'];
  addMemory(s, 'sleptOnFloor', 0);
  expect(moodTarget(s, 0)).toBe(0);
});

test('el ánimo se acerca al objetivo 10 por hora, sin pasarse', () => {
  const w = emptyWorld(3, 3);
  const s = w.survivors[0]!;
  s.needs.mood = 20;
  for (let i = 0; i < TICKS_PER_HOUR; i++) moodSystem(w);
  expect(s.needs.mood).toBeCloseTo(30, 5);
  for (let i = 0; i < 10 * TICKS_PER_HOUR; i++) moodSystem(w);
  expect(s.needs.mood).toBe(50);
});

test('el ánimo inicial es el objetivo', () => {
  for (const s of createWorld(4).survivors) expect(s.needs.mood).toBe(moodTarget(s, 0));
});
