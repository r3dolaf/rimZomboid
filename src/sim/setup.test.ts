// C2: los comienzos (gente, camas, almacén, armas y vendas) y los ajustes a medida (infección, botín,
// asedios, hambre y sed, frío). El pueblo con todo normal es la partida de siempre.
import { expect, test } from 'vitest';
import {
  BANDAGES_CARRIED,
  HUNGER_PER_TICK,
  SIEGE_EVERY,
  START_ANTIBIOTICS,
  START_FOOD,
  START_WATER_BOTTLES,
  THIRST_PER_TICK,
  TICKS_PER_DAY,
  WOUNDS,
} from './balance';
import { checkInvariants } from './invariants';
import { firstSiegeAt } from './narrator';
import { outdoorTemp } from './season';
import { DEFAULT_SETUP, infectChance, lootMult, needsMult, setupOf } from './setup';
import { siteMap } from './sites';
import { needsSystem } from './systems/needs';
import type { GameSetup, SiteInfo, World } from './types';
import { createWorld } from './world';

const with_ = (o: Partial<GameSetup>): GameSetup => ({ ...DEFAULT_SETUP, ...o });

/** Lo comparable de una partida nueva. */
const snap = (w: World) => JSON.stringify({ ...w, common: { ...w.common, setup: undefined } });

test('el pueblo con todo normal es la partida de siempre (sin `setup` o con él)', () => {
  const a = createWorld(7, 'balanced', 'normal');
  const b = createWorld(7, 'balanced', 'normal', DEFAULT_SETUP);
  expect(snap(b)).toBe(snap(a));
  expect(setupOf(a)).toEqual(DEFAULT_SETUP);
  delete a.common.setup;
  expect(setupOf(a)).toEqual(DEFAULT_SETUP); // una partida de antes
});

test('solo: una persona con su cama; familia numerosa: cinco con la suya', () => {
  const solo = createWorld(3, 'balanced', 'normal', with_({ scenario: 'solo' }));
  expect(solo.survivors).toHaveLength(1);
  expect(solo.beds).toHaveLength(1);
  expect(solo.storage.items.food).toBe(START_FOOD);
  const family = createWorld(3, 'balanced', 'normal', with_({ scenario: 'family' }));
  expect(family.survivors).toHaveLength(5);
  expect(family.beds).toHaveLength(5);
  expect(new Set(family.survivors.map((s) => s.name)).size).toBe(5);
  for (const w of [solo, family]) expect(checkInvariants(w)).toEqual([]);
});

test('con lo puesto: el almacén vacío, sin cuchillo ni vendas encima', () => {
  const w = createWorld(3, 'balanced', 'normal', with_({ scenario: 'bare' }));
  expect(w.survivors).toHaveLength(3);
  const s = w.storage.items;
  expect([s.food, s.waterBottle, s.antibiotics, s.seeds]).toEqual([0, 0, 0, 0]);
  for (const p of w.survivors) {
    expect(p.equipped).toBeNull();
    expect(p.carrying.bandage).toBe(0);
  }
  expect(checkInvariants(w)).toEqual([]);
  const town = createWorld(3);
  for (const p of town.survivors) expect(p.carrying.bandage).toBe(BANDAGES_CARRIED);
});

test('infección: un arañazo o un corte, ×0,5 o ×1,5; un mordisco, siempre', () => {
  const low = createWorld(1, 'balanced', 'normal', with_({ infection: 'low' }));
  const high = createWorld(1, 'balanced', 'normal', with_({ infection: 'high' }));
  expect(infectChance(low, 'scratch')).toBeCloseTo(WOUNDS.scratch.infect * 0.5);
  expect(infectChance(high, 'scratch')).toBeCloseTo(Math.min(1, WOUNDS.scratch.infect * 1.5));
  expect(infectChance(low, 'bite')).toBe(1);
  expect(infectChance(createWorld(1), 'cut')).toBe(WOUNDS.cut.infect);
});

/** Lo que hay de algo en los muebles. */
const inFurniture = (w: World, k: 'food' | 'bandage' | 'wood') =>
  w.containers.reduce((n, c) => n + c.items[k], 0);

test('botín: escaso o abundante, en los muebles del pueblo, en los sitios y en el almacén', () => {
  const normal = createWorld(5);
  const scarce = createWorld(5, 'balanced', 'normal', with_({ loot: 'low' }));
  const plenty = createWorld(5, 'balanced', 'normal', with_({ loot: 'high' }));
  expect(lootMult(scarce)).toBe(0.6);
  expect(inFurniture(scarce, 'food')).toBeLessThan(inFurniture(normal, 'food'));
  expect(inFurniture(plenty, 'food')).toBeGreaterThan(inFurniture(normal, 'food'));
  expect(inFurniture(plenty, 'bandage')).toBeGreaterThan(inFurniture(normal, 'bandage'));
  expect(inFurniture(plenty, 'wood')).toBe(inFurniture(normal, 'wood')); // la madera, igual
  expect(scarce.storage.items.food).toBe(Math.round(START_FOOD * 0.6));
  expect(plenty.storage.items.waterBottle).toBe(Math.round(START_WATER_BOTTLES * 1.5));
  expect(plenty.storage.items.antibiotics).toBe(Math.round(START_ANTIBIOTICS * 1.5));
  const info: SiteInfo = {
    id: 1,
    kind: 'gas',
    special: null,
    side: 0,
    hours: 4,
    state: 'known',
    visited: false,
    specialUntil: null,
    leftAt: null,
    extraZombies: 0,
    hex: 200,
  };
  const siteNormal = siteMap(normal, { ...info });
  const sitePlenty = siteMap(plenty, { ...info });
  expect(inFurniture(sitePlenty, 'food')).toBeGreaterThan(inFurniture(siteNormal, 'food'));
  for (const w of [normal, scarce, plenty]) expect(checkInvariants(w)).toEqual([]);
});

test('asedios: el primero y los siguientes, más espaciados (pocos) o más seguidos (muchos)', () => {
  const at = (sieges: GameSetup['sieges']) => firstSiegeAt(9, 'balanced', with_({ sieges }));
  expect(at('low')).toBeGreaterThan(at('normal'));
  expect(at('high')).toBeLessThan(at('normal'));
  const w = createWorld(9, 'balanced', 'normal', with_({ sieges: 'high' }));
  expect(w.narrator.nextSiegeAt).toBe(at('high'));
  expect(SIEGE_EVERY.balanced[0] * 0.7 * TICKS_PER_DAY).toBeGreaterThan(0);
});

test('hambre y sed: bajan ×0,8 o ×1,25', () => {
  for (const [needs, mult] of [
    ['low', 0.8],
    ['normal', 1],
    ['high', 1.25],
  ] as const) {
    const w = createWorld(2, 'balanced', 'normal', with_({ needs }));
    expect(needsMult(w)).toBe(mult);
    const s = w.survivors[0]!;
    s.traits = []; // sin Glotón
    s.needs.hunger = 80;
    s.needs.thirst = 80;
    s.fever = null;
    needsSystem(w);
    expect(80 - s.needs.hunger).toBeCloseTo(HUNGER_PER_TICK * mult);
    expect(80 - s.needs.thirst).toBeCloseTo(THIRST_PER_TICK * mult, 5);
  }
});

test('frío: fuera, 4 grados más (suave) o menos (duro)', () => {
  const normal = createWorld(2);
  const mild = createWorld(2, 'balanced', 'normal', with_({ cold: 'low' }));
  const harsh = createWorld(2, 'balanced', 'normal', with_({ cold: 'high' }));
  const t = 40 * TICKS_PER_DAY;
  expect(outdoorTemp(mild, t) - outdoorTemp(normal, t)).toBeCloseTo(4);
  expect(outdoorTemp(harsh, t) - outdoorTemp(normal, t)).toBeCloseTo(-4);
});
