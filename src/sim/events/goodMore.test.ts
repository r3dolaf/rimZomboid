// Sucesos buenos nuevos (H6c §2.8): «Provisiones en la puerta» y «Un buen día», que se repiten.
import { expect, test } from 'vitest';
import {
  GOOD_DAY_COOLDOWN_DAYS,
  MEMORY_EFFECTS,
  SUPPLIES_BANDAGES_MAX,
  SUPPLIES_BANDAGES_MIN,
  SUPPLIES_COOLDOWN_DAYS,
  SUPPLIES_FOOD_MAX,
  SUPPLIES_FOOD_MIN,
  TICKS_PER_DAY,
} from '../balance';
import { moodModifiers } from '../mood';
import { chooseEvent } from '../narrator';
import type { World } from '../types';
import { createWorld } from '../world';
import { CATALOG } from './catalog';
import { goodDayEvent } from './goodDay';
import { suppliesEvent } from './supplies';

let BASE: World | null = null;
function calm(): World {
  BASE ??= createWorld(3);
  const w = structuredClone(BASE);
  w.narrator.nextEventAt = 1e9;
  return w;
}

test('los dos están en el catálogo, son buenos y vuelven a salir pasados unos días', () => {
  expect(CATALOG).toContain(suppliesEvent);
  expect(CATALOG).toContain(goodDayEvent);
  expect(suppliesEvent.tone).toBe('good');
  expect(goodDayEvent.tone).toBe('good');
  expect(suppliesEvent.cooldownDays).toBe(SUPPLIES_COOLDOWN_DAYS);
  expect(goodDayEvent.cooldownDays).toBe(GOOD_DAY_COOLDOWN_DAYS);
});

test('provisiones en la puerta: latas (y a veces vendas) al almacén, con su línea en el registro', () => {
  let withBandages = 0;
  for (let i = 0; i < 200; i++) {
    const w = calm();
    w.rng = { s: i * 7919 + 1 };
    const before = { ...w.storage.items };
    expect(suppliesEvent.canHappen(w)).toBe(true);
    suppliesEvent.happen(w);
    const e = w.common.log.at(-1)!;
    if (e.kind !== 'supplies') throw new Error('falta el suceso');
    expect(e.food).toBeGreaterThanOrEqual(SUPPLIES_FOOD_MIN);
    expect(e.food).toBeLessThanOrEqual(SUPPLIES_FOOD_MAX);
    expect(w.storage.items.food).toBe(before.food + e.food);
    expect(w.storage.items.bandage).toBe(before.bandage + e.bandage);
    if (e.bandage > 0) {
      withBandages++;
      expect(e.bandage).toBeGreaterThanOrEqual(SUPPLIES_BANDAGES_MIN);
      expect(e.bandage).toBeLessThanOrEqual(SUPPLIES_BANDAGES_MAX);
    }
  }
  expect(withBandages).toBeGreaterThan(50);
  expect(withBandages).toBeLessThan(150);
});

test('sin nadie en la colonia no hay provisiones ni buen día', () => {
  const w = calm();
  w.survivors = [];
  expect(suppliesEvent.canHappen(w)).toBe(false);
  expect(goodDayEvent.canHappen(w)).toBe(false);
});

test('un buen día: todos de mejor ánimo un rato; con tormenta no sale', () => {
  const w = calm();
  expect(goodDayEvent.canHappen(w)).toBe(true);
  goodDayEvent.happen(w);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'goodDay' });
  expect(MEMORY_EFFECTS.goodDay.value).toBeGreaterThan(0);
  for (const s of w.survivors) {
    expect(moodModifiers(s, w.tick).some((m) => m.id === 'goodDay')).toBe(true);
    const end = w.tick + MEMORY_EFFECTS.goodDay.hours * (TICKS_PER_DAY / 24);
    expect(moodModifiers(s, end + 1).some((m) => m.id === 'goodDay')).toBe(false);
  }
  const s2 = calm();
  s2.common.stormUntil = s2.tick + 100;
  expect(goodDayEvent.canHappen(s2)).toBe(false);
});

test('se repiten: pasada la espera, el narrador puede volver a sacarlos', () => {
  const w = calm();
  const only = [suppliesEvent];
  w.narrator.style = 'chaotic';
  // Con un catálogo de un solo suceso, el narrador lo saca venga el tono que venga.
  expect(chooseEvent(w, only)).toBe(suppliesEvent);
  w.narrator.lastAt.supplies = w.tick;
  expect(chooseEvent(w, only)).toBeNull();
  w.tick += SUPPLIES_COOLDOWN_DAYS * TICKS_PER_DAY;
  expect(chooseEvent(w, only)).toBe(suppliesEvent);
});
