// H5c1 §2–§3: sitios conocidos y cómo se descubren (mapas, notas, humo y radio).
import { expect, test } from 'vitest';
import {
  KNOWN_SITES_MAX,
  LOOT,
  SITE_BURN_PER_DAY,
  SITE_HORDE_PER_DAY,
  SITE_HORDE_ZOMBIES,
  SITE_HOURS,
  SITE_ZOMBIES_PER_DAY,
  SITE_RUMOR_PER_DAY,
  TICKS_PER_DAY,
  ZOMBIE_NOTE_CHANCE,
} from './balance';
import { checkInvariants } from './invariants';
import {
  catchUp,
  discoverSite,
  readFindings,
  siteMap,
  siteZombiesAtStart,
  sitesDailySystem,
} from './sites';
import { emptyWorld } from './testing/fixtures';
import { createWorld } from './world';

test('descubrir un sitio: tipo, lado y horas al azar; ids seguidos; tope de 10 conocidos', () => {
  const w = emptyWorld(10, 10);
  expect(w.common.expedition).toMatchObject({ sites: [], travels: [], nextSiteId: 1 });
  const a = discoverSite(w, { how: 'roadMap' })!;
  expect(a.id).toBe(1);
  expect(['house', 'farm', 'gas', 'warehouse', 'village']).toContain(a.kind);
  expect(a.hours).toBeGreaterThanOrEqual(SITE_HOURS[0]);
  expect(a.hours).toBeLessThanOrEqual(SITE_HOURS[1]);
  expect(a).toMatchObject({ state: 'known', visited: false, leftAt: null });
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'siteFound', how: 'roadMap' });
  const north = discoverSite(w, { how: 'explore', side: 0, special: 'survivors' })!;
  expect(north).toMatchObject({ id: 2, side: 0, special: 'survivors' });
  expect(north.specialUntil).toBeGreaterThanOrEqual(w.tick + 2 * TICKS_PER_DAY);
  expect(north.specialUntil).toBeLessThanOrEqual(w.tick + 3 * TICKS_PER_DAY);
  while (w.common.expedition.sites.length < KNOWN_SITES_MAX) discoverSite(w, { how: 'smoke' });
  expect(discoverSite(w, { how: 'smoke' })).toBeNull();
  w.common.expedition.sites[0]!.state = 'lost'; // uno perdido deja sitio
  expect(discoverSite(w, { how: 'smoke' })).not.toBeNull();
});

test('mapas de carreteras y notas: al llegar al almacén descubren un sitio cada uno', () => {
  const w = emptyWorld(10, 10);
  w.storage.items.roadMap = 2;
  w.storage.items.note = 1;
  readFindings(w);
  expect(w.storage.items.roadMap + w.storage.items.note).toBe(0);
  expect(w.common.expedition.sites).toHaveLength(3);
  expect(w.common.log.filter((e) => e.kind === 'siteFound').map((e) => e.how)).toEqual([
    'roadMap',
    'roadMap',
    'note',
  ]);
  expect(checkInvariants(w)).toEqual([]);
});

test('mapas y notas en el botín (casas y gasolineras) y algunas notas en los zombis', () => {
  expect(LOOT.house.roadMap).toEqual({ chance: 0.1 });
  expect(LOOT.gas.roadMap).toEqual({ chance: 0.5 });
  expect(LOOT.house.note).toEqual({ chance: 0.05 });
  expect(ZOMBIE_NOTE_CHANCE).toBe(0.03);
  let maps = 0;
  for (const seed of [1, 2, 3, 4]) {
    const w = createWorld(seed);
    maps += w.containers.reduce((n, c) => n + c.items.roadMap, 0);
  }
  expect(maps).toBeGreaterThan(0);
});

test('de vez en cuando, humo o una llamada por radio descubren un sitio (la radio, más supervivientes)', () => {
  expect(SITE_RUMOR_PER_DAY).toBe(0.15);
  const w = emptyWorld(10, 10);
  for (let day = 1; day <= 60; day++) {
    w.tick = day * TICKS_PER_DAY;
    sitesDailySystem(w);
  }
  const found = w.common.log.filter((e) => e.kind === 'siteFound');
  expect(found.length).toBeGreaterThan(2);
  expect(found.every((e) => e.how === 'smoke' || e.how === 'radio')).toBe(true);
});

test('al volver a un sitio, ha pasado el tiempo: más zombis (con tope) y otros se han llevado cosas', () => {
  const w = emptyWorld(10, 10);
  const info = discoverSite(w, { how: 'roadMap', special: null })!;
  const site = siteMap(w, info);
  const zombies = site.zombies.length;
  const food = site.containers.reduce((n, c) => n + c.items.food, 0);
  site.storage.items.food = 10; // lo dejado en el campamento
  w.tick += 3 * TICKS_PER_DAY;
  catchUp(site, info, w.tick);
  expect(site.tick).toBe(w.tick);
  expect(site.zombies.length).toBe(
    Math.min(zombies + 3 * SITE_ZOMBIES_PER_DAY, 2 * siteZombiesAtStart(info)),
  );
  const keep = 0.9 ** 3;
  expect(site.storage.items.food).toBe(10 - Math.round(10 * (1 - keep)));
  expect(site.containers.reduce((n, c) => n + c.items.food, 0)).toBeLessThan(food + 1);
  expect(checkInvariants(w)).toEqual([]);
  // Solo una vez por ausencia.
  const now = site.zombies.length;
  catchUp(site, info, w.tick);
  expect(site.zombies.length).toBe(now);
});

test('cada día, un sitio sin gente puede quemarse (se pierde) o llenarse de zombis; los supervivientes dejan de esperar', () => {
  expect([SITE_BURN_PER_DAY, SITE_HORDE_PER_DAY, SITE_HORDE_ZOMBIES]).toEqual([0.02, 0.03, 10]);
  const w = emptyWorld(10, 10);
  for (let i = 0; i < 6; i++) siteMap(w, discoverSite(w, { how: 'roadMap', special: null })!);
  const help = discoverSite(w, { how: 'note', special: 'survivors' })!;
  for (let day = 1; day <= 80; day++) {
    w.tick = day * TICKS_PER_DAY;
    sitesDailySystem(w);
    expect(checkInvariants(w)).toEqual([]);
  }
  const changes = w.common.log.filter((e) => e.kind === 'siteChanged').map((e) => e.change);
  expect(changes).toContain('burned');
  expect(changes).toContain('overrun');
  expect(changes).toContain('silent');
  expect(help.special).toBeNull();
  const lost = w.common.expedition.sites.filter((x) => x.state === 'lost');
  expect(lost.length).toBeGreaterThan(0);
  for (const x of lost) expect(w.siteMaps.some((m) => m.siteId === x.id)).toBe(false);
});
