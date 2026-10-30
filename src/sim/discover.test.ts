// H5c2 §2–§3: los sitios están repartidos por el mundo desde el principio, ocultos; se descubren al
// despejar la niebla (viajando, explorando), con un mapa de carreteras, una nota, el humo o la radio.
import { expect, test } from 'vitest';
import { ATLAS_SITES, ATLAS_START_SEEN, ROADMAP_RADIUS, SITE_MIN_DIST } from './balance';
import { hexDistance, hexesWithin, sideFrom } from './atlas/hex';
import { findRoute, routeHours } from './atlas/route';
import { checkInvariants } from './invariants';
import { discoverSite, reveal } from './sites';
import { addWorldSites, emptyWorld } from './testing/fixtures';
import { createWorld } from './world';

test('al crear la partida, 40–60 sitios ocultos, cada uno en su hexágono, según el terreno', () => {
  for (const seed of [1, 2, 3, 4]) {
    const w = createWorld(seed);
    const { atlas, expedition } = w.common;
    const sites = expedition.sites;
    expect(sites.length).toBeGreaterThanOrEqual(ATLAS_SITES[0]);
    expect(sites.length).toBeLessThanOrEqual(ATLAS_SITES[1]);
    expect(sites.map((s) => s.id)).toEqual(sites.map((_, i) => i + 1));
    expect(expedition.nextSiteId).toBe(sites.length + 1);
    expect(new Set(sites.map((s) => s.hex)).size).toBe(sites.length);
    for (const s of sites) {
      expect(s.state).toBe('hidden');
      expect(atlas.terrain[s.hex]).not.toBe('water');
      expect(hexDistance(atlas, s.hex, atlas.base)).toBeGreaterThanOrEqual(SITE_MIN_DIST);
      expect(s.side).toBe(sideFrom(atlas, atlas.base, s.hex));
      if (s.kind === 'village')
        expect(hexesWithin(atlas, s.hex, 1).some((i) => atlas.town[i] === 1)).toBe(true);
    }
    const kinds = new Set(sites.map((s) => s.kind));
    for (const k of ['farm', 'house', 'gas'] as const)
      expect(kinds.has(k), `${seed} ${k}`).toBe(true);
    // Solo se conoce lo de alrededor de la base (y ahí no hay sitios).
    const seen = atlas.seen.flatMap((v, i) => (v === 1 ? [i] : []));
    expect(seen.sort((a, b) => a - b)).toEqual(
      hexesWithin(atlas, atlas.base, ATLAS_START_SEEN).sort((a, b) => a - b),
    );
    expect(checkInvariants(w)).toEqual([]);
  }
});

test('despejar la niebla descubre los sitios de la zona, con su lado y sus horas (una sola vez)', () => {
  const w = createWorld(3);
  const { atlas } = w.common;
  const s = w.common.expedition.sites[0]!;
  const found = reveal(w, s.hex, 1, 'seen');
  expect(found).toContain(s);
  expect(s.state).toBe('known');
  for (const i of hexesWithin(atlas, s.hex, 1)) expect(atlas.seen[i]).toBe(1);
  expect(s.hours).toBe(
    Math.max(1, Math.round(routeHours(atlas, findRoute(atlas, atlas.base, s.hex)!))),
  );
  const logged = () => w.common.log.filter((e) => e.kind === 'siteFound').length;
  const n = logged();
  expect(n).toBeGreaterThanOrEqual(1);
  expect(w.common.log.find((e) => e.kind === 'siteFound')).toMatchObject({ how: 'seen' });
  reveal(w, s.hex, 1, 'seen');
  expect(logged()).toBe(n); // ya se conocían
});

test('un mapa de carreteras despeja una zona grande; una nota, el humo o la radio, un sitio', () => {
  const w = createWorld(5);
  const { atlas } = w.common;
  const seenCount = () => atlas.seen.filter((v) => v === 1).length;
  const before = seenCount();
  const a = discoverSite(w, { how: 'roadMap' })!;
  expect(a.state).toBe('known');
  for (const i of hexesWithin(atlas, a.hex, ROADMAP_RADIUS)) expect(atlas.seen[i]).toBe(1);
  expect(seenCount()).toBeGreaterThan(before);
  const b = discoverSite(w, { how: 'radio', special: 'survivors' })!;
  expect(b).toMatchObject({ state: 'known', special: 'survivors' });
  expect(b.specialUntil).not.toBeNull();
  expect(atlas.seen[b.hex]).toBe(1);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'siteFound', how: 'radio' });
  expect(checkInvariants(w)).toEqual([]);
});

test('sin sitios ocultos (o sin sitios), un mapa, una nota, el humo o la radio no hacen nada', () => {
  const w = emptyWorld(10, 10);
  expect(discoverSite(w, { how: 'smoke' })).toBeNull();
  addWorldSites(w, 2);
  for (const s of w.common.expedition.sites) s.state = 'known';
  expect(discoverSite(w, { how: 'note' })).toBeNull();
});

test('las comprobaciones del juego: cada sitio en un hexágono propio, dentro del mundo y no en el agua', () => {
  const w = createWorld(2);
  const [a, b] = w.common.expedition.sites;
  b!.hex = a!.hex;
  expect(checkInvariants(w).some((p) => p.includes('otro sitio en su hexágono'))).toBe(true);
  b!.hex = -3;
  expect(checkInvariants(w).some((p) => p.includes('fuera del mundo'))).toBe(true);
});
