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
  const ids = w.survivors
    .filter((s) => canGo(s, w))
    .slice(0, 2)
    .map((s) => s.id);
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

test('un archivo a medias (con versión y algo de forma) tampoco se carga, y nunca rompe', () => {
  expect(loadGame('{"version":1,"meta":{},"world":{"common":{},"grid":{}}}')).toEqual({
    error: 'broken',
  });
  const w = createWorld(1);
  const good = JSON.parse(saveGame(w, meta)) as { world: { siteMaps: unknown } };
  good.world.siteMaps = {};
  expect(loadGame(JSON.stringify(good))).toEqual({ error: 'broken' });
  good.world.siteMaps = [{}];
  expect(loadGame(JSON.stringify(good))).toEqual({ error: 'broken' });
  const badMeta = JSON.parse(saveGame(w, meta)) as { meta: { day: unknown } };
  badMeta.meta.day = 'x';
  expect(loadGame(JSON.stringify(badMeta))).toEqual({ error: 'broken' });
});

/** Quita de una partida guardada lo que no había en la versión 1 (V1: el huerto y lo nuevo). */
function asVersion1(text: string): string {
  const file = JSON.parse(text) as { version: number; world: unknown };
  file.version = 1;
  const strip = (x: unknown): void => {
    if (typeof x !== 'object' || x === null) return;
    if (Array.isArray(x)) return x.forEach(strip);
    const o = x as Record<string, unknown>;
    if (Array.isArray(o.pieces) && typeof o.food === 'number') {
      delete o.seeds;
      delete o.veg;
      delete o.meal;
    }
    for (const k of ['work', 'priorities', 'skills'])
      if (typeof o[k] === 'object' && o[k] !== null) delete (o[k] as Record<string, unknown>).farm;
    if ('chopMarks' in o) delete o.plots;
    if ('siegesRepelled' in o) delete o.harvested;
    if (typeof o.hunger === 'number') delete o.thirst; // (y V2: la sed)
    Object.values(o).forEach(strip);
  };
  strip(file.world);
  return JSON.stringify(file);
}

test('V1: una partida de la versión 1 se sigue cargando, con lo nuevo a 0 y Cultivar', () => {
  const w = createWorld(7);
  for (let i = 0; i < 600; i++) stepGame(w);
  const old = asVersion1(saveGame(w, meta));
  expect(old).not.toContain('"seeds"');
  const loaded = loadGame(old);
  if ('error' in loaded) throw new Error(loaded.error);
  const lw = loaded.world;
  expect(lw.plots).toEqual([]);
  expect(lw.common.stats.harvested).toBe(0);
  expect(lw.storage.items.seeds).toBe(0);
  expect(lw.storage.items.meal).toBe(0);
  for (const s of lw.survivors) {
    expect(s.work.farm).toBe(true);
    expect(s.priorities.farm).toBe(3);
    expect(s.skills.farm).toEqual({ level: 0, xp: 0 });
    expect(s.carrying.veg).toBe(0);
  }
  expect(checkInvariants(lw)).toEqual([]);
  for (let i = 0; i < 600; i++) stepGame(lw); // y se sigue jugando
  expect(checkInvariants(lw)).toEqual([]);
});

/** Como la versión 2: sin la sed ni el fregadero de la base (V2). */
function asVersion2(text: string, w: World): string {
  const file = JSON.parse(text) as { version: number; world: World };
  file.version = 2;
  const strip = (x: unknown): void => {
    if (typeof x !== 'object' || x === null) return;
    if (Array.isArray(x)) return x.forEach(strip);
    const o = x as Record<string, unknown>;
    if (typeof o.hunger === 'number') delete o.thirst;
    Object.values(o).forEach(strip);
  };
  strip(file.world);
  const r = w.base.rect;
  file.world.furniture = file.world.furniture.filter(
    (f) =>
      !(
        f.kind === 'sink' &&
        f.pos.x >= r.x &&
        f.pos.y >= r.y &&
        f.pos.x < r.x + r.w &&
        f.pos.y < r.y + r.h
      ),
  );
  return JSON.stringify(file);
}

test('V2: una partida de la versión 2 se sigue cargando, con la sed y el fregadero de la base', () => {
  const w = createWorld(7);
  for (let i = 0; i < 600; i++) stepGame(w);
  const old = asVersion2(saveGame(w, meta), w);
  expect(old).not.toContain('"thirst"');
  const loaded = loadGame(old);
  if ('error' in loaded) throw new Error(loaded.error);
  const lw = loaded.world;
  for (const s of lw.survivors) expect(s.needs.thirst).toBe(s.needs.hunger);
  const r = lw.base.rect;
  const sinks = lw.furniture.filter(
    (f) =>
      f.kind === 'sink' &&
      f.pos.x >= r.x &&
      f.pos.y >= r.y &&
      f.pos.x < r.x + r.w &&
      f.pos.y < r.y + r.h,
  );
  expect(sinks).toHaveLength(1);
  expect(checkInvariants(lw)).toEqual([]);
  for (let i = 0; i < 600; i++) stepGame(lw);
  expect(checkInvariants(lw)).toEqual([]);
});

test('V3: una partida de la versión 3 se sigue cargando, con sus hogueras con 12 h de leña', () => {
  const w = createWorld(7);
  w.furniture.push({
    id: w.common.nextId++,
    kind: 'campfire',
    pos: { ...w.storage.tiles[0]!, y: w.storage.tiles[0]!.y - 2 },
  });
  const file = JSON.parse(saveGame(w, meta)) as { version: number; world: World };
  file.version = 3;
  const loaded = loadGame(JSON.stringify(file));
  if ('error' in loaded) throw new Error(loaded.error);
  expect(loaded.world.furniture.find((f) => f.kind === 'campfire')?.fuel).toBe(12);
});

test('C1: una partida de la versión 4 se sigue cargando, con radio y pilas a 0 en todo lo que guarda cosas', () => {
  const w = createWorld(7);
  const file = JSON.parse(saveGame(w, meta)) as { version: number; world: World };
  file.version = 4;
  // Como era: sin radio ni pilas en el almacén, los muebles, las cargas ni las bolsas.
  const strip = (x: unknown): void => {
    if (typeof x !== 'object' || x === null) return;
    if (Array.isArray(x)) return x.forEach(strip);
    const o = x as Record<string, unknown>;
    if (Array.isArray(o.pieces) && typeof o.food === 'number') {
      delete o.radio;
      delete o.battery;
    }
    Object.values(o).forEach(strip);
  };
  strip(file.world);
  expect(file.world.storage.items.battery).toBeUndefined();
  const loaded = loadGame(JSON.stringify(file));
  if ('error' in loaded) throw new Error(loaded.error);
  const lw = loaded.world;
  expect(lw.storage.items.radio).toBe(0);
  expect(lw.storage.items.battery).toBe(0);
  expect(lw.containers.every((c) => c.items.battery >= 0 && c.items.radio === 0)).toBe(true);
  expect(lw.survivors.every((s) => s.carrying.battery === 0)).toBe(true);
  expect(checkInvariants(lw)).toEqual([]);
});

test('D1: una partida de la versión 5 se sigue cargando, con armas y munición a 0 en todo lo que guarda cosas', () => {
  const w = createWorld(7);
  const file = JSON.parse(saveGame(w, meta)) as { version: number; world: World };
  file.version = 5;
  const KINDS = ['pistol', 'shotgun', 'ammo', 'shells'];
  const strip = (x: unknown): void => {
    if (typeof x !== 'object' || x === null) return;
    if (Array.isArray(x)) return x.forEach(strip);
    const o = x as Record<string, unknown>;
    if (Array.isArray(o.pieces) && typeof o.food === 'number') for (const k of KINDS) delete o[k];
    Object.values(o).forEach(strip);
  };
  strip(file.world);
  expect(file.world.storage.items.ammo).toBeUndefined();
  const loaded = loadGame(JSON.stringify(file));
  if ('error' in loaded) throw new Error(loaded.error);
  const lw = loaded.world;
  for (const k of ['pistol', 'shotgun', 'ammo', 'shells'] as const) {
    expect(lw.storage.items[k]).toBe(0);
    expect(lw.containers.every((c) => c.items[k] === 0)).toBe(true);
    expect(lw.survivors.every((s) => s.carrying[k] === 0)).toBe(true);
  }
  expect(checkInvariants(lw)).toEqual([]);
  for (let i = 0; i < 300; i++) stepGame(lw);
  expect(checkInvariants(lw)).toEqual([]);
});

test('E1: una partida de la versión 6 se sigue cargando, con generadores y bidones a 0', () => {
  expect(SAVE_VERSION).toBe(7);
  const w = createWorld(7);
  const file = JSON.parse(saveGame(w, meta)) as { version: number; world: World };
  file.version = 6;
  const strip = (x: unknown): void => {
    if (typeof x !== 'object' || x === null) return;
    if (Array.isArray(x)) return x.forEach(strip);
    const o = x as Record<string, unknown>;
    if (Array.isArray(o.pieces) && typeof o.food === 'number') {
      delete o.generator;
      delete o.gasCan;
    }
    Object.values(o).forEach(strip);
  };
  strip(file.world);
  const loaded = loadGame(JSON.stringify(file));
  if ('error' in loaded) throw new Error(loaded.error);
  const lw = loaded.world;
  expect(lw.storage.items.generator).toBe(0);
  expect(lw.storage.items.gasCan).toBe(0);
  expect(lw.survivors.every((s) => s.carrying.gasCan === 0)).toBe(true);
  expect(checkInvariants(lw)).toEqual([]);
});
