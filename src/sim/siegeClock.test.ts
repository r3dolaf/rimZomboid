// N1: el asedio con su propio ritmo: el primer anuncio en su margen según el narrador, a su hora se
// anuncia y se pone el siguiente, con uno anunciado o en marcha se mira al día siguiente, el
// Tranquilo con la colonia mal lo aplaza, el sorteo ya no lo saca y una partida sin reloj lo pone.
import { expect, test } from 'vitest';
import { SIEGE_EVERY, SIEGE_FIRST, TICKS_PER_DAY } from './balance';
import { dayStart } from './clock';
import { CATALOG } from './events/catalog';
import { chooseEvent, narratorSystem } from './narrator';
import type { NarratorStyle, World } from './types';
import { createWorld } from './world';

const STYLES: NarratorStyle[] = ['calm', 'balanced', 'chaotic'];

test('el primer anuncio, dentro del margen de su narrador', () => {
  for (const style of STYLES)
    for (let seed = 1; seed <= 6; seed++) {
      const w = createWorld(seed, style);
      const [lo, hi] = SIEGE_FIRST[style];
      const at = w.narrator.nextSiegeAt!;
      expect(at).toBeGreaterThanOrEqual(dayStart(lo));
      expect(at).toBeLessThan(dayStart(hi + 1));
    }
});

/** El narrador, tick a tick, hasta `tick` (sin el resto del juego). */
function runNarrator(w: World, until: number): void {
  while (w.tick < until) {
    narratorSystem(w, []);
    w.tick++;
  }
}

test('a su hora se anuncia el asedio y se pone el siguiente, en el margen de después', () => {
  const w = createWorld(3, 'balanced');
  const at = w.narrator.nextSiegeAt!;
  runNarrator(w, at);
  expect(w.siege).toBeNull();
  narratorSystem(w, []);
  expect(w.siege).not.toBeNull();
  expect(w.common.log.at(-1)?.kind).toBe('siegeAnnounced');
  const [lo, hi] = SIEGE_EVERY.balanced;
  const next = w.narrator.nextSiegeAt! - w.tick;
  expect(next).toBeGreaterThanOrEqual(lo * TICKS_PER_DAY);
  expect(next).toBeLessThanOrEqual(hi * TICKS_PER_DAY);
});

test('con un asedio anunciado o en marcha, se mira al día siguiente', () => {
  const w = createWorld(3, 'chaotic');
  w.tick = w.narrator.nextSiegeAt!;
  w.siege = { at: w.tick + TICKS_PER_DAY, side: 0, size: 10 };
  narratorSystem(w, []);
  expect(w.narrator.nextSiegeAt).toBe(w.tick + TICKS_PER_DAY);
  expect(w.common.log.some((e) => e.kind === 'siegeAnnounced')).toBe(false);
});

test('el Tranquilo, con la colonia mal, lo aplaza un día; con la colonia bien, llega', () => {
  const w = createWorld(3, 'calm');
  w.tick = w.narrator.nextSiegeAt!;
  w.storage.items.food = 0;
  for (const s of w.survivors) s.needs.mood = 0;
  narratorSystem(w, []);
  expect(w.siege).toBeNull();
  expect(w.narrator.nextSiegeAt).toBe(w.tick + TICKS_PER_DAY);
  w.tick = w.narrator.nextSiegeAt!;
  w.storage.items.food = 100;
  for (const s of w.survivors) s.needs.mood = 100;
  narratorSystem(w, []);
  expect(w.siege).not.toBeNull();
});

test('el sorteo del narrador ya no saca asedios', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = createWorld(seed, 'chaotic');
    w.tick = dayStart(20);
    for (let k = 0; k < 20; k++) expect(chooseEvent(w, CATALOG)?.id).not.toBe('siege');
  }
});

test('una partida sin reloj (de antes) lo pone al seguir, en el margen del primero', () => {
  const w = createWorld(4, 'balanced');
  delete w.narrator.nextSiegeAt;
  w.tick = dayStart(15);
  narratorSystem(w, []);
  const [lo, hi] = SIEGE_FIRST.balanced;
  const d = w.narrator.nextSiegeAt! - w.tick;
  expect(d).toBeGreaterThanOrEqual((lo - 1) * TICKS_PER_DAY);
  expect(d).toBeLessThanOrEqual(hi * TICKS_PER_DAY);
});
