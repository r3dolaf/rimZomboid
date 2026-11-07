import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../sim/balance';
import { darkness } from '../sim/clock';
import { setTile } from '../sim/map/grid';
import { damageTile } from '../sim/structures';
import { addSurvivor, emptyWorld } from '../sim/testing/fixtures';
import { Tile, type Wound, type World } from '../sim/types';
import { newZombie } from '../sim/zombies/spawn';
import { ambienceOf, createWatcher, randomCues, WORK_MS } from './cues';
import type { ListenerView } from './space';

// Se ve el mapa entero de 30×30 casillas.
const view: ListenerView = { x: 0, y: 0, w: 30, h: 30 };

const wound = (id: number): Wound => ({
  id,
  part: 'torso',
  kind: 'scratch',
  size: 1,
  damage: 1,
  at: 0,
  bleeding: false,
  cleanUntil: 0,
});

function nightTick(): number {
  for (let t = 0; ; t += TICKS_PER_HOUR) if (darkness(t) === 1) return t;
}

function world(): World {
  return emptyWorld(30, 30);
}

test('el primer fotograma no suena', () => {
  const w = world();
  const s = addSurvivor(w, { x: 5, y: 5 });
  s.wounds.push(wound(1));
  setTile(w.grid, 10, 10, Tile.Door);
  damageTile(w, 10, 10, 1);
  s.action = { type: 'chop', tree: 0, ticksLeft: 50 };
  expect(createWatcher().watch(w, 0, true)).toEqual([]);
});

test('una herida nueva de un colono: hurt, donde está', () => {
  const w = world();
  const s = addSurvivor(w, { x: 5, y: 5 });
  const watcher = createWatcher();
  watcher.watch(w, 0, true);
  s.wounds.push(wound(1));
  expect(watcher.watch(w, 16, true)).toEqual([{ id: 'hurt', at: { x: 5.5, y: 5.5 } }]);
  expect(watcher.watch(w, 32, true)).toEqual([]);
});

test('un zombi que pierde vida: hitZombie', () => {
  const w = world();
  const z = newZombie(w, { x: 8, y: 3 });
  w.zombies.push(z);
  const watcher = createWatcher();
  watcher.watch(w, 0, true);
  z.health -= 10;
  expect(watcher.watch(w, 16, true)).toEqual([{ id: 'hitZombie', at: { x: 8.5, y: 3.5 } }]);
});

test('un golpe a una puerta (le baja la resistencia): bang; el primero y los siguientes', () => {
  const w = world();
  setTile(w.grid, 10, 10, Tile.Door);
  const watcher = createWatcher();
  watcher.watch(w, 0, true);
  damageTile(w, 10, 10, 1);
  expect(watcher.watch(w, 16, true)).toEqual([{ id: 'bang', at: { x: 10.5, y: 10.5 } }]);
  expect(watcher.watch(w, 32, true)).toEqual([]);
  damageTile(w, 10, 10, 1);
  expect(watcher.watch(w, 48, true)).toEqual([{ id: 'bang', at: { x: 10.5, y: 10.5 } }]);
});

test('una ventana rota: glass; una puerta o un muro rotos: crash', () => {
  const w = world();
  setTile(w.grid, 1, 1, Tile.Window);
  setTile(w.grid, 2, 1, Tile.BoardedWindow);
  setTile(w.grid, 3, 1, Tile.LockedDoor);
  setTile(w.grid, 4, 1, Tile.WoodWall);
  const watcher = createWatcher();
  watcher.watch(w, 0, true);
  setTile(w.grid, 1, 1, Tile.BrokenWindow);
  setTile(w.grid, 2, 1, Tile.BrokenWindow);
  setTile(w.grid, 3, 1, Tile.BrokenDoor);
  setTile(w.grid, 4, 1, Tile.Rubble);
  expect(watcher.watch(w, 16, true)).toEqual([
    { id: 'glass', at: { x: 1.5, y: 1.5 } },
    { id: 'glass', at: { x: 2.5, y: 1.5 } },
    { id: 'crash', at: { x: 3.5, y: 1.5 } },
    { id: 'crash', at: { x: 4.5, y: 1.5 } },
  ]);
});

test('un árbol talado: treeFall; otros cambios de casilla, nada', () => {
  const w = world();
  setTile(w.grid, 6, 6, Tile.Tree);
  const watcher = createWatcher();
  watcher.watch(w, 0, true);
  setTile(w.grid, 6, 6, Tile.Grass);
  setTile(w.grid, 7, 7, Tile.WoodWall); // construir un muro no suena así
  expect(watcher.watch(w, 16, true)).toEqual([{ id: 'treeFall', at: { x: 6.5, y: 6.5 } }]);
});

test('otro mapa (o el mismo cargado de nuevo) empieza de cero, sin sonar', () => {
  const a = world();
  const b = world();
  b.mapId = 3;
  const s = addSurvivor(b, { x: 2, y: 2 });
  const watcher = createWatcher();
  watcher.watch(a, 0, true);
  s.wounds.push(wound(1));
  setTile(b.grid, 4, 4, Tile.BrokenWindow);
  expect(watcher.watch(b, 16, true)).toEqual([]);
  // y al volver al primero, tampoco
  setTile(a.grid, 4, 4, Tile.BrokenWindow);
  expect(watcher.watch(a, 32, true)).toEqual([]);
});

test('talar, forzar y construir suenan cada poco, solo si avanza la partida', () => {
  expect(WORK_MS).toEqual({ chop: 650, pry: 900, build: 420 });
  const w = world();
  const s = addSurvivor(w, { x: 5, y: 5 });
  s.action = { type: 'chop', tree: 0, ticksLeft: 50 };
  const watcher = createWatcher();
  expect(watcher.watch(w, 0, true)).toEqual([]);
  expect(watcher.watch(w, 10, true)).toEqual([{ id: 'chop', at: { x: 5.5, y: 5.5 } }]);
  expect(watcher.watch(w, 600, true)).toEqual([]);
  expect(watcher.watch(w, 660, true)).toEqual([{ id: 'chop', at: { x: 5.5, y: 5.5 } }]);
  expect(watcher.watch(w, 2000, false)).toEqual([]); // en pausa
  s.action = { type: 'pry', door: 0, ticksLeft: 50 };
  expect(watcher.watch(w, 2016, true).map((c) => c.id)).toEqual(['pry']);
  s.action = { type: 'build', blueprintId: 1 };
  expect(watcher.watch(w, 2032, true).map((c) => c.id)).toEqual(['build']);
});

test('gemidos: con zombis que se oyen, alguno; sin zombis o con mala suerte, nada', () => {
  const w = world();
  w.tick = nightTick(); // de noche no hay pájaros
  expect(randomCues(w, view, 1000, () => 0)).toEqual([]);
  const z = newZombie(w, { x: 12, y: 12 });
  w.zombies.push(z);
  expect(randomCues(w, view, 1000, () => 0)).toEqual([{ id: 'groan', at: z.pos }]);
  expect(randomCues(w, view, 1000, () => 0.999)).toEqual([]);
  // uno que no se oye (lejísimos) no gime
  z.pos = { x: 500, y: 500 };
  expect(randomCues(w, view, 1000, () => 0)).toEqual([]);
});

test('pájaros: de día y sin lluvia, en algún sitio de lo que se ve', () => {
  const w = world();
  const birds = randomCues(w, view, 1000, () => 0);
  expect(birds.map((c) => c.id)).toEqual(['bird']);
  expect(birds[0]!.at.x).toBeGreaterThanOrEqual(0);
  expect(birds[0]!.at.x).toBeLessThanOrEqual(30);
  w.common.rainUntil = w.tick + 100;
  expect(randomCues(w, view, 1000, () => 0)).toEqual([]);
});

test('el ambiente de día, sin nada', () => {
  expect(ambienceOf(world(), view)).toEqual({ rain: 0, wind: 0, fire: 0, crickets: 0, birds: 1 });
});

test('el ambiente de noche: grillos, más bajos con lluvia', () => {
  const w = world();
  w.tick = nightTick();
  expect(ambienceOf(w, view)).toMatchObject({ crickets: 1, birds: 0 });
  w.common.rainUntil = w.tick + 100;
  expect(ambienceOf(w, view)).toMatchObject({ crickets: 0.3, rain: 0.6, wind: 0 });
});

test('con tormenta: lluvia fuerte y viento', () => {
  const w = world();
  w.common.stormUntil = w.tick + 100;
  expect(ambienceOf(w, view)).toMatchObject({ rain: 1, wind: 1, birds: 0 });
});

test('la hoguera suena según lo cerca que esté del centro', () => {
  const w = world();
  w.furniture.push({ id: 1, kind: 'campfire', pos: { x: 14, y: 14 } });
  expect(ambienceOf(w, view).fire).toBeGreaterThan(0.9);
  w.furniture[0]!.pos = { x: 500, y: 500 };
  expect(ambienceOf(w, view).fire).toBe(0);
});

test('tras reset (la pestaña del mundo), el siguiente fotograma no suena', () => {
  const w = world();
  const s = addSurvivor(w, { x: 5, y: 5 });
  const watcher = createWatcher();
  watcher.watch(w, 0, true);
  watcher.reset();
  s.wounds.push(wound(1));
  setTile(w.grid, 4, 4, Tile.BrokenWindow);
  expect(watcher.watch(w, 16, true)).toEqual([]);
  s.wounds.push(wound(2));
  expect(watcher.watch(w, 32, true).map((c) => c.id)).toEqual(['hurt']);
});
