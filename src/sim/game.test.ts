// H5c1 §1: una caja común (registro, atuendos, numeración…) y una caja por mapa.
import { expect, test } from 'vitest';
import { newBag } from './bags';
import { newGarment } from './clothes';
import { logEvent } from './log';
import { issue, ordersSystem } from './orders';
import { allAsleep } from './colony';
import { activeMaps, allColonists, allMaps, mapById, stepGame } from './game';
import { checkInvariants } from './invariants';
import { runTicks } from '../game/runTicks';
import { emptyWorld, fixturePerson, moveTo, siteForTest } from './testing/fixtures';
import { Tile } from './types';

test('dos mapas con la misma caja común comparten registro, atuendos y numeración', () => {
  const base = emptyWorld(10, 10);
  expect(base.mapId).toBe(0);
  expect(base.siteMaps).toEqual([]);
  const site = emptyWorld(8, 8);
  site.common = base.common;
  site.mapId = 7;
  logEvent(site, { kind: 'rain' });
  expect(base.common.log.at(-1)).toMatchObject({ kind: 'rain', mapId: 7 });
  logEvent(base, { kind: 'rain' });
  expect(base.common.log.at(-1)).not.toHaveProperty('mapId'); // la base, sin marca
  const made = base.common.pieceLog.made;
  const a = newGarment(base, 'cap');
  const b = newBag(site, 'schoolBag');
  expect(b.id).toBe(a.id + 1);
  expect(base.common.pieceLog.made).toBe(made + 2);
  issue(site, { type: 'addOutfit' });
  ordersSystem(site);
  expect(base.common.outfits).toHaveLength(4);
});

test('stepGame avanza la base y los sitios con gente; un sitio sin nadie se queda quieto', () => {
  const base = floorWorld();
  const busy = siteForTest(base, 1);
  const empty = siteForTest(base, 2);
  moveTo(base, busy, base.survivors[0]!);
  base.survivors.push(fixturePerson(base, 'Bea'));
  stepGame(base);
  stepGame(base);
  expect([base.tick, busy.tick, empty.tick]).toEqual([2, 2, 0]);
  expect(allMaps(base)).toEqual([base, busy, empty]);
  expect(activeMaps(base)).toEqual([base, busy]);
  expect(mapById(base, 2)).toBe(empty);
  expect(allColonists(base).map((x) => x.where)).toEqual([0, 1]);
  runTicks(base, 3);
  expect(busy.tick).toBe(5);
});

test('en un sitio no hay narrador ni llegadas de zombis por los bordes', () => {
  const base = floorWorld();
  const site = siteForTest(base, 1);
  moveTo(base, site, base.survivors[0]!);
  site.narrator.nextEventAt = 0;
  site.nextZombieAt = 0;
  for (let i = 0; i < 50; i++) stepGame(base);
  expect(site.zombies).toEqual([]);
  expect(base.common.log.some((e) => e.mapId === 1 && e.kind.startsWith('event'))).toBe(false);
});

test('la partida sigue mientras quede alguien en algún mapa; el ×6, si duermen todos', () => {
  const base = floorWorld();
  const site = siteForTest(base, 1);
  const ana = base.survivors[0]!;
  moveTo(base, site, ana);
  stepGame(base);
  expect(base.common.over).toBeNull();
  ana.action = { type: 'sleep', inBed: false };
  expect(allAsleep(base)).toBe(true);
  base.survivors.push(fixturePerson(base, 'Bea'));
  expect(allAsleep(base)).toBe(false);
  base.survivors = [];
  site.survivors = [];
  stepGame(base);
  expect(base.common.over).not.toBeNull();
});

test('comprobaciones entre mapas: piezas e ids repetidos, y cuentas de todo', () => {
  const base = emptyWorld(10, 10);
  const site = siteForTest(base, 1);
  expect(checkInvariants(base)).toEqual([]);
  const ana = base.survivors[0]!;
  moveTo(base, site, ana);
  expect(checkInvariants(base)).toEqual([]); // su ropa sigue contando, ahora en el sitio
  site.storage.items.wood = 2;
  base.storage.items.wood -= 0;
  base.common.woodLog.start += 2;
  expect(checkInvariants(base)).toEqual([]);
  const twin = { ...fixturePerson(base, 'Bea'), id: ana.id, worn: [] };
  base.survivors.push(twin);
  expect(checkInvariants(base).join('\n')).toMatch(/repetid/);
  base.survivors.pop();
  site.storage.items.pieces.push(ana.worn[0]!);
  expect(checkInvariants(base).join('\n')).toMatch(/dos sitios/);
});

/** Un mundo de prueba con suelo (para que los que no tienen nada que hacer paseen por la base). */
function floorWorld() {
  const w = emptyWorld(10, 10);
  w.grid.tiles.fill(Tile.Floor);
  return w;
}
