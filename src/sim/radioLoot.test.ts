// C1 §1: la radio, solo en los sitios del mapa del mundo (en cada nave, una; en las gasolineras y
// los pueblecitos, a veces); las pilas, en casas, gasolineras, naves, supermercados y comisarías,
// también en el pueblo de la base. Las dos con su propio azar.
import { expect, test } from 'vitest';
import { BATTERY_LOOT, SITE_RADIO } from './balance';
import { checkInvariants } from './invariants';
import { siteMap } from './sites';
import { emptyWorld } from './testing/fixtures';
import type { SiteInfo, SiteKind, World } from './types';
import { createWorld } from './world';

const info = (id: number, kind: SiteKind): SiteInfo => ({
  id,
  kind,
  special: null,
  side: 0,
  hours: 4,
  state: 'known',
  visited: false,
  specialUntil: null,
  leftAt: null,
  extraZombies: 0,
  hex: 200 + id,
});

const total = (w: World, k: 'radio' | 'battery') =>
  w.containers.reduce((n, c) => n + c.items[k], 0);

test('en cada nave hay una radio; en una casa aislada o una granja, ninguna', () => {
  expect(SITE_RADIO.warehouse).toBe(1);
  for (let id = 1; id <= 6; id++) {
    const base = emptyWorld(10, 10);
    base.seed = 1000 + id;
    expect(total(siteMap(base, info(id, 'warehouse')), 'radio')).toBe(1);
    expect(total(siteMap(base, info(id + 10, 'house')), 'radio')).toBe(0);
    expect(total(siteMap(base, info(id + 20, 'farm')), 'radio')).toBe(0);
    expect(checkInvariants(base)).toEqual([]);
  }
});

test('en las gasolineras y los pueblecitos, a veces (y nunca más de una)', () => {
  let gas = 0;
  let village = 0;
  for (let id = 1; id <= 30; id++) {
    const base = emptyWorld(10, 10);
    base.seed = 77 + id;
    const g = total(siteMap(base, info(id, 'gas')), 'radio');
    const v = total(siteMap(base, info(id + 100, 'village')), 'radio');
    expect(g).toBeLessThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(1);
    gas += g;
    village += v;
  }
  expect(gas).toBeGreaterThan(0);
  expect(gas).toBeLessThan(30);
  expect(village).toBeGreaterThan(0);
  expect(village).toBeLessThan(30);
});

test('las pilas: en el pueblo de la base y en los sitios, pero nunca una radio en el pueblo', () => {
  expect(BATTERY_LOOT.gas).toEqual([2, 4]);
  for (let seed = 1; seed <= 5; seed++) {
    const w = createWorld(seed);
    expect(total(w, 'radio')).toBe(0);
    expect(total(w, 'battery')).toBeGreaterThan(0);
    expect(w.storage.items.radio + w.storage.items.battery).toBe(0);
  }
  const base = emptyWorld(10, 10);
  expect(total(siteMap(base, info(1, 'gas')), 'battery')).toBeGreaterThanOrEqual(2);
});
