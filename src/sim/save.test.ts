// H6b §1: guardar y cargar: la misma partida, con el mismo futuro tick a tick (también con sitios y
// viajes); la caja común, una sola vez; versión distinta o archivo roto, no se carga.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from './balance';
import { canGo } from './expeditions';
import { stepGame } from './game';
import { checkInvariants } from './invariants';
import { issue } from './orders';
import { discoverSite } from './sites';
import { loadGame, saveGame, SAVE_VERSION, type SaveMeta } from './save';
import type { World } from './types';
import { createWorld } from './world';

const meta: SaveMeta = {
  day: 1,
  seed: 7,
  narrator: 'balanced',
  zombies: 'normal',
  savedAt: '2026-11-04T10:00:00.000Z',
};

/** Lo comparable de una partida: todo, con los sitios sin su caja común (que es la de la base). */
const snapshot = (w: World) =>
  JSON.stringify({
    ...w,
    siteMaps: w.siteMaps.map((m) => ({ ...m, world: { ...m.world, common: undefined } })),
  });

test('guardar y cargar: la misma partida y, al seguir, el mismo futuro', () => {
  const w = createWorld(7);
  for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
  for (let i = 0; i < TICKS_PER_DAY / 2; i++) stepGame(w);
  const text = saveGame(w, meta);
  const loaded = loadGame(text);
  if ('error' in loaded) throw new Error(loaded.error);
  expect(loaded.meta).toEqual(meta);
  expect(snapshot(loaded.world)).toBe(snapshot(w));
  for (let i = 0; i < TICKS_PER_DAY / 2; i++) {
    stepGame(w);
    stepGame(loaded.world);
  }
  expect(snapshot(loaded.world)).toBe(snapshot(w));
  expect(checkInvariants(loaded.world)).toEqual([]);
});

test('con sitios y viajes: los sitios comparten otra vez la caja común de la base', () => {
  const w = createWorld(3);
  const site = discoverSite(w, { how: 'roadMap', special: null })!;
  const ids = w.survivors.filter((s) => canGo(s, w)).slice(0, 2).map((s) => s.id);
  issue(w, { type: 'sendExpedition', from: 0, siteId: site.id, survivorIds: ids, items: {} });
  for (let i = 0; i < 2 * TICKS_PER_DAY && w.siteMaps.length === 0; i++) stepGame(w);
  const text = saveGame(w, meta);
  expect(text.split('"atlas"').length - 1).toBe(1); // la caja común, una sola vez
  const loaded = loadGame(text);
  if ('error' in loaded) throw new Error(loaded.error);
  const lw = loaded.world;
  for (const m of lw.siteMaps) expect(m.world.common).toBe(lw.common);
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    stepGame(w);
    stepGame(lw);
  }
  expect(snapshot(lw)).toBe(snapshot(w));
  expect(checkInvariants(lw)).toEqual([]);
});

test('una versión distinta o un archivo que no es una partida no se cargan (y se dice)', () => {
  const w = createWorld(1);
  const text = saveGame(w, meta);
  const old = JSON.parse(text) as { version: number };
  old.version = SAVE_VERSION + 1;
  expect(loadGame(JSON.stringify(old))).toEqual({ error: 'version' });
  expect(loadGame('hola')).toEqual({ error: 'broken' });
  expect(loadGame('{"version":1}')).toEqual({ error: 'broken' });
});
