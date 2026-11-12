// C3: la crónica: lo que se apunta (siempre, la primera vez, lo que no), su límite, las partidas
// guardadas y las trampas.
import { expect, test } from 'vitest';
import { CHRONICLE_MAX } from './balance';
import { chronicled } from './chronicle';
import { logEvent } from './log';
import { issue, ordersSystem } from './orders';
import { loadGame, saveGame, type SaveMeta } from './save';
import { emptyWorld } from './testing/fixtures';
import { createWorld } from './world';

const meta: SaveMeta = {
  day: 1,
  seed: 7,
  narrator: 'balanced',
  zombies: 'normal',
  savedAt: '2026-11-12T10:00:00.000Z',
};

test('siempre: muertes, parejas, asedios, amputaciones, crisis fuertes, estaciones, el final…', () => {
  const w = emptyWorld(10, 10);
  logEvent(w, { kind: 'died', name: 'Ana', cause: 'infection' });
  logEvent(w, { kind: 'couple', survivorId: 1, otherId: 2 });
  logEvent(w, { kind: 'siegeArrived', x: 1, y: 1 });
  logEvent(w, { kind: 'siegeArrived', x: 1, y: 1 });
  logEvent(w, { kind: 'amputated', survivorId: 1, part: 'leftArm', ok: true });
  logEvent(w, { kind: 'crisis', survivorId: 1, crisis: 'flee' });
  logEvent(w, { kind: 'season', season: 'autumn' });
  logEvent(w, { kind: 'colonyFell' });
  expect(w.common.chronicle!.map((e) => e.kind)).toEqual([
    'died',
    'couple',
    'siegeArrived',
    'siegeArrived',
    'amputated',
    'crisis',
    'season',
    'colonyFell',
  ]);
  expect(w.common.chronicle![0]!.tick).toBe(w.tick);
});

test('la primera vez: el agua, sin comida, zombis en la base, una pelea, la inspiración…', () => {
  const w = emptyWorld(10, 10);
  for (let i = 0; i < 3; i++) {
    logEvent(w, { kind: 'outOfFood' });
    logEvent(w, { kind: 'zombiesInBase', x: 1, y: 1 });
    logEvent(w, { kind: 'fight', survivorId: 1, otherId: 2 });
    logEvent(w, { kind: 'inspired', survivorId: 1 });
  }
  expect(w.common.chronicle!.map((e) => e.kind)).toEqual([
    'outOfFood',
    'zombiesInBase',
    'fight',
    'inspired',
  ]);
});

test('lo de todos los días no: saquear, encerrarse, vendar, matar un zombi…', () => {
  const w = emptyWorld(10, 10);
  logEvent(w, { kind: 'zombieKilled', survivorId: 1 });
  logEvent(w, { kind: 'crisis', survivorId: 1 });
  logEvent(w, { kind: 'crisis', survivorId: 1, crisis: 'sulk' });
  logEvent(w, { kind: 'bandaged', survivorId: 1, otherId: 2 });
  logEvent(w, { kind: 'rain' });
  expect(w.common.chronicle ?? []).toEqual([]);
  expect(chronicled({ kind: 'built', what: 'radio' }, [])).toBe(true);
  expect(chronicled({ kind: 'built', what: 'bed' }, [])).toBe(false);
});

test('como mucho CHRONICLE_MAX (se quitan los más viejos)', () => {
  const w = emptyWorld(10, 10);
  for (let i = 0; i < CHRONICLE_MAX + 5; i++) {
    w.tick = i;
    logEvent(w, { kind: 'siegeArrived', x: 1, y: 1 });
  }
  expect(w.common.chronicle).toHaveLength(CHRONICLE_MAX);
  expect(w.common.chronicle![0]!.tick).toBe(5);
});

test('se guarda con la partida; una de antes empieza con lo de su registro', () => {
  const w = createWorld(7);
  logEvent(w, { kind: 'couple', survivorId: w.survivors[0]!.id, otherId: w.survivors[1]!.id });
  const again = loadGame(saveGame(w, meta));
  if ('error' in again) throw new Error(again.error);
  expect(again.world.common.chronicle).toEqual(w.common.chronicle);
  const file = JSON.parse(saveGame(w, meta)) as { world: { common: Record<string, unknown> } };
  delete file.world.common.chronicle;
  const old = loadGame(JSON.stringify(file));
  if ('error' in old) throw new Error(old.error);
  expect(old.world.common.chronicle!.map((e) => e.kind)).toEqual(['couple']);
});

test('una trampa de depuración marca la partida', () => {
  const w = emptyWorld(10, 10);
  expect(w.common.cheated ?? false).toBe(false);
  issue(w, { type: 'debug', action: 'reveal' });
  ordersSystem(w);
  expect(w.common.cheated).toBe(true);
});
