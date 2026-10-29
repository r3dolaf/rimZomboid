// H5c1 §4: viajar (solo de día; de noche duermen), comer y vendarse con lo suyo, morir por el
// camino, y llegar a un sitio o volver a la base.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from './balance';
import { dayStart } from './clock';
import { newBag } from './bags';
import { allAsleep } from './colony';
import { exitTile } from './expeditions';
import { allColonists, mapById, stepGame } from './game';
import { checkInvariants } from './invariants';
import { discoverSite } from './sites';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type Travel, type World } from './types';

function world(): World {
  const w = emptyWorld(20, 20);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.base.door = { x: 10, y: 10 };
  return w;
}

/** Ana sale de viaje (como si ya hubiera dejado el mapa). */
function onTheRoad(w: World, kind: Travel['kind'], hours: number, siteId: number | null): Survivor {
  const ana = w.survivors[0]!;
  w.survivors = [];
  ana.pos = { x: -10, y: -10 };
  w.common.expedition.travels.push({
    id: 50,
    kind,
    siteId,
    side: 0,
    members: [ana],
    hoursLeft: hours,
    pending: [],
  });
  return ana;
}

/** Pone el reloj en ese día y hora (el juego empieza a las 8). */
const at = (w: World, day: number, hour: number) =>
  (w.tick = dayStart(day) + hour * TICKS_PER_HOUR);

test('solo se viaja de 6 a 20 h; de noche duermen (y cuentan para el ×6)', () => {
  const w = world();
  const site = discoverSite(w, { how: 'roadMap', side: 0 })!;
  const ana = onTheRoad(w, 'go', 2, site.id);
  at(w, 1, 19);
  for (let i = 0; i < TICKS_PER_HOUR; i++) stepGame(w);
  expect(w.common.expedition.travels[0]!.hoursLeft).toBeCloseTo(1, 6);
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) stepGame(w);
  expect(w.common.expedition.travels[0]!.hoursLeft).toBeCloseTo(1, 6); // de noche, nada
  expect(ana.action.type).toBe('sleep');
  expect(allAsleep(w)).toBe(true);
  expect(allColonists(w).map((x) => x.where)).toEqual(['travel']);
  at(w, 2, 6);
  for (let i = 0; i < TICKS_PER_HOUR && w.common.expedition.travels.length > 0; i++) stepGame(w);
  expect(w.common.expedition.travels).toEqual([]); // ha llegado
  const m = mapById(w, site.id)!;
  expect(m.survivors).toEqual([ana]);
  expect(site.visited).toBe(true);
  expect(w.common.log.some((e) => e.kind === 'expeditionArrived')).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('de vuelta, entran a la base por su lado', () => {
  const w = world();
  const ana = onTheRoad(w, 'back', 0.001, 1);
  at(w, 1, 10);
  stepGame(w);
  expect(w.survivors).toEqual([ana]);
  const exit = exitTile(w, 0);
  expect({ x: Math.floor(ana.pos.x), y: Math.floor(ana.pos.y) }).toEqual(exit);
});

test('de viaje comen de lo suyo con hambre y se vendan si sangran', () => {
  const w = world();
  const ana = onTheRoad(w, 'go', 8, null);
  at(w, 1, 8);
  const bag = newBag(w, 'schoolBag');
  bag.items.food = 1;
  bag.items.bandage = 1;
  ana.bags.back = bag;
  ana.carrying.bandage = 0;
  ana.needs.hunger = 20;
  ana.wounds = [
    {
      id: 1,
      part: 'leftArm',
      kind: 'cut',
      size: 10,
      damage: 10,
      at: w.tick,
      bleeding: true,
      cleanUntil: 0,
    },
  ];
  stepGame(w);
  expect(ana.needs.hunger).toBeGreaterThan(20);
  expect(bag.items.food).toBe(0);
  expect(ana.wounds[0]!.bleeding).toBe(false);
  expect(ana.wounds[0]!.cleanUntil).toBeGreaterThan(w.tick);
  expect(bag.items.bandage).toBe(0);
});

test('quien muere por el camino se pierde con lo que llevaba; sin nadie más, se acaba', () => {
  const w = world();
  const ana = onTheRoad(w, 'go', 8, null);
  at(w, 1, 8);
  ana.carrying.wood = 2;
  w.common.woodLog.start += 2;
  ana.blood = 0.001;
  ana.wounds = [
    {
      id: 1,
      part: 'torso',
      kind: 'bite',
      size: 10,
      damage: 10,
      at: w.tick,
      bleeding: true,
      cleanUntil: 0,
    },
  ];
  ana.carrying.bandage = 0;
  stepGame(w);
  stepGame(w);
  expect(w.common.expedition.travels).toEqual([]);
  expect(w.common.dead.map((d) => d.name)).toEqual([ana.name]);
  expect(checkInvariants(w)).toEqual([]);
  expect(w.common.over).not.toBeNull();
});
