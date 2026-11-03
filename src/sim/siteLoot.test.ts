// H6a §2: cada tipo de sitio con su especialidad: el pueblecito siempre con farmacia (antibióticos y
// vendas), la nave con armas y herramientas, la gasolinera con latas y a veces antibióticos, la granja
// con mucha comida; el pueblo de la base, casi sin antibióticos.
import { expect, test } from 'vitest';
import { SITE_LOOT } from './balance';
import { checkInvariants } from './invariants';
import { WEAPONS } from './jobs/weapons';
import { generateSite } from './map/site';
import { createRng } from './rng';
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

const total = (w: World, k: 'antibiotics' | 'food') =>
  w.containers.reduce((n, c) => n + c.items[k], 0);

test('el pueblecito siempre tiene farmacia', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = generateSite('village', null, 0, createRng(seed));
    expect(g.houses.some((h) => h.kind === 'pharmacy')).toBe(true);
  }
});

test('en un pueblecito hay antibióticos; en la nave, armas; en la granja, mucha comida (y las cuentas cuadran)', () => {
  const base = emptyWorld(10, 10);
  const village = siteMap(base, info(1, 'village'));
  expect(SITE_LOOT.pharmacy?.antibiotics).toEqual([4, 6]);
  expect(total(village, 'antibiotics')).toBeGreaterThanOrEqual(3);
  const warehouse = siteMap(base, info(2, 'warehouse'));
  const weapons = warehouse.containers.reduce(
    (n, c) => n + WEAPONS.reduce((k, x) => k + c.items[x], 0),
    0,
  );
  expect(weapons).toBeGreaterThanOrEqual(4);
  const farm = siteMap(base, info(3, 'farm'));
  expect(total(farm, 'food')).toBeGreaterThanOrEqual(20);
  const all = [village, warehouse, farm].reduce(
    (n, m) => n + m.containers.reduce((k, c) => k + WEAPONS.reduce((j, x) => j + c.items[x], 0), 0),
    0,
  );
  expect(base.common.weaponLog.fromSites).toBe(all);
  expect(checkInvariants(base)).toEqual([]);
});

test('en el pueblo de la base, casi ningún antibiótico', () => {
  let n = 0;
  for (let seed = 1; seed <= 6; seed++) n += total(createWorld(seed), 'antibiotics');
  expect(n / 6).toBeLessThan(2);
});
