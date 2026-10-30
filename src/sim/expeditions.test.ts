// H5c1 §4: formar el grupo, prepararse en el almacén con la lista del grupo y salir por el borde.
import { expect, test } from 'vitest';
import { ACTIVE_SITES_MAX } from './balance';
import { exitTile } from './expeditions';
import { checkInvariants } from './invariants';
import { issue, ordersSystem } from './orders';
import { discoverSite } from './sites';
import { step } from './step';
import { activeMaps, stepGame } from './game';
import { addSurvivor, addWorldSites, emptyWorld, moveTo, siteForTest } from './testing/fixtures';
import { Tile, type World } from './types';

/** La base de 20×20 con suelo, el almacén en (5, 5), Ana y Bea sin más que hacer. */
function world(): World {
  const w = emptyWorld(20, 20);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 5, y: 5 }];
  w.storage.items.food = 10;
  w.storage.items.bandage = 6;
  w.base.door = { x: 10, y: 10 };
  addSurvivor(w, { x: 8, y: 8 }, 'Bea');
  for (const s of w.survivors) {
    s.pos = { x: 8.5, y: 8.5 };
    for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
    s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
    s.nextChatAt = 1e9;
    s.carrying.bandage = 0;
  }
  return w;
}

test('la casilla de salida: la del borde de ese lado más cerca de la puerta', () => {
  const w = world();
  expect(exitTile(w, 0)).toEqual({ x: 10, y: 0 });
  expect(exitTile(w, 1)).toEqual({ x: 10, y: 19 });
  expect(exitTile(w, 2)).toEqual({ x: 0, y: 10 });
  expect(exitTile(w, 3)).toEqual({ x: 19, y: 10 });
});

test('mandar un grupo: se reparten la lista; los que no pueden ir, no van; sitios conocidos', () => {
  const w = world();
  const [ana, bea] = w.survivors;
  issue(w, { type: 'sendExpedition', siteId: 99, survivorIds: [ana!.id], items: {} });
  ordersSystem(w);
  expect(ana!.trip).toBeNull(); // ese sitio no existe
  addWorldSites(w); // H5c2: los sitios del mundo, ocultos
  const site = discoverSite(w, { how: 'note', side: 0 })!;
  bea!.action = { type: 'downed', until: 1e9 };
  issue(w, {
    type: 'sendExpedition',
    siteId: site.id,
    survivorIds: [ana!.id, bea!.id],
    items: { food: 5 },
  });
  ordersSystem(w);
  expect(bea!.trip).toBeNull(); // derribada
  expect(ana!.trip).toMatchObject({ stage: 'prepare', items: { food: 5 } });
  const travel = w.common.expedition.travels[0]!;
  expect(travel).toMatchObject({
    kind: 'go',
    siteId: site.id,
    side: 0,
    members: [],
    pending: [ana!.id],
  });
  expect(travel.hoursLeft).toBe(site.hours);
});

test('se prepara en el almacén (su «Llevar siempre» y su parte de la lista), va al borde y sale', () => {
  const w = world();
  const [ana, bea] = w.survivors;
  addWorldSites(w); // H5c2: los sitios del mundo, ocultos
  const site = discoverSite(w, { how: 'note', side: 0 })!;
  issue(w, {
    type: 'sendExpedition',
    siteId: site.id,
    survivorIds: [ana!.id, bea!.id],
    items: { food: 5 },
  });
  const travel = () => w.common.expedition.travels[0]!;
  for (let i = 0; i < 400 && w.survivors.length > 0; i++) step(w);
  expect(w.survivors).toEqual([]);
  expect(travel().pending).toEqual([]);
  expect(travel().members.map((s) => s.name)).toEqual(expect.arrayContaining(['Ana', 'Bea']));
  const food = travel().members.reduce((n, s) => n + s.carrying.food, 0);
  expect(food).toBe(5);
  expect(w.storage.items.food).toBe(5);
  for (const s of travel().members) expect(s.carrying.bandage).toBe(2); // «Llevar siempre»
  expect(checkInvariants(w)).toEqual([]); // lo de los viajeros sigue contando
});

test('como mucho 4 sitios con gente o de camino a la vez', () => {
  const w = world();
  for (let i = 0; i < ACTIVE_SITES_MAX + 1; i++) {
    const s = addSurvivor(w, { x: 3, y: 3 }, `P${i}`);
    if (i === 0) addWorldSites(w);
    const site = discoverSite(w, { how: 'smoke' })!;
    issue(w, { type: 'sendExpedition', siteId: site.id, survivorIds: [s.id], items: {} });
    ordersSystem(w);
  }
  expect(w.common.expedition.travels).toHaveLength(ACTIVE_SITES_MAX);
});

/** Un sitio de prueba conocido (id 7, hacia el norte) con Ana y Bea en su campamento. */
function inSite(): { w: World; site: World } {
  const w = world();
  const site = siteForTest(w, 7, 16, 16);
  site.grid.tiles.fill(Tile.Floor);
  site.seen.fill(1);
  w.common.expedition.sites.push({
    id: 7,
    kind: 'farm',
    special: null,
    side: 0,
    hours: 3,
    state: 'known',
    visited: true,
    specialUntil: null,
    leftAt: null,
    extraZombies: 0,
    hex: 300,
  });
  for (const s of [...w.survivors]) moveTo(w, site, s);
  return { w, site };
}

test('volver: cargan del campamento primero comida, vendas, analgésicos y armas, salen y viajan', () => {
  const { w, site } = inSite();
  Object.assign(site.storage.items, { food: 30, bandage: 3, painkillers: 1, machete: 1, wood: 10 });
  w.common.woodLog.start += 10;
  w.common.weaponLog.fromCorpses += 1;
  issue(w, { type: 'returnHome', siteId: 7 });
  for (let i = 0; i < 400 && site.survivors.length > 0; i++) stepGame(w);
  expect(site.survivors).toEqual([]);
  const t = w.common.expedition.travels[0]!;
  expect(t).toMatchObject({ kind: 'back', siteId: 7, side: 0, pending: [] });
  expect(t.hoursLeft).toBe(3);
  const carried = (k: 'food' | 'bandage' | 'painkillers' | 'machete' | 'wood') =>
    t.members.reduce((n, s) => n + s.carrying[k], 0);
  expect(carried('bandage')).toBe(3);
  expect(carried('painkillers')).toBe(1);
  expect(carried('machete') + t.members.filter((s) => s.equipped === 'machete').length).toBe(1);
  expect(carried('food')).toBeGreaterThan(0);
  expect(site.storage.items.wood).toBeGreaterThan(0); // la madera, al final: no cabe toda
  expect(w.common.expedition.sites[0]!.leftAt).toBe(site.tick - 1); // (salió en ese tick)
  expect(activeMaps(w)).toEqual([w]); // el sitio queda quieto
  expect(checkInvariants(w)).toEqual([]);
});

test('otro grupo al mismo sitio se junta con los que hay', () => {
  const { w, site } = inSite();
  const carla = addSurvivor(w, { x: 9, y: 9 }, 'Carla');
  w.common.expedition.travels.push({
    id: 90,
    kind: 'go',
    siteId: 7,
    side: 0,
    members: [carla],
    hoursLeft: 0.001,
    pending: [],
  });
  w.survivors = w.survivors.filter((s) => s !== carla);
  w.tick = 1000; // de día
  stepGame(w);
  expect(site.survivors.map((s) => s.name)).toEqual(
    expect.arrayContaining(['Ana', 'Bea', 'Carla']),
  );
  expect(checkInvariants(w)).toEqual([]);
});
