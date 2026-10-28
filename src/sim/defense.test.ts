// H4a, datos: madera, hacha, casillas nuevas, montones, planos, muebles y trabajos.
import { expect, test } from 'vitest';
import { ITEM_WEIGHT_KG } from './balance';
import { checkInvariants } from './invariants';
import { ITEM_KINDS } from './items';
import { createGrid, isWalkable, setTile } from './map/grid';
import { Tile } from './types';
import { isOpaque } from './vision';
import { createWorld } from './world';

test('madera (1 kg) y hacha (2 kg); se cogen después de las armas', () => {
  expect(ITEM_WEIGHT_KG.wood).toBe(1);
  expect(ITEM_WEIGHT_KG.axe).toBe(2);
  // (Detrás, los objetos de H4d.)
  expect(ITEM_KINDS.slice(0, 6)).toEqual(['food', 'bandage', 'knife', 'bat', 'axe', 'wood']);
});

test('muro de madera y ventana tapiada: ni se pasa ni se ve', () => {
  const g = createGrid(3, 3, Tile.Grass);
  for (const t of [Tile.WoodWall, Tile.BoardedWindow]) {
    setTile(g, 1, 1, t);
    expect(isWalkable(g, 1, 1)).toBe(false);
    expect(isOpaque(g, 1, 1)).toBe(true);
  }
});

test('la cuadrícula lleva la cuenta de sus cambios (para redibujar el mapa)', () => {
  const g = createGrid(3, 3, Tile.Grass);
  const v = g.version;
  setTile(g, 0, 0, Tile.Tree);
  expect(g.version).toBe(v + 1);
});

test('siempre hay madera y al menos un hacha por el mapa (H4f: según el tipo de edificio)', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const w = createWorld(seed);
    expect(w.containers.reduce((acc, c) => acc + c.items.wood, 0)).toBeGreaterThan(40);
    expect(w.containers.reduce((acc, c) => acc + c.items.axe, 0)).toBeGreaterThanOrEqual(1);
  }
});

test('al empezar: sin montones, planos, muebles ni marcas; cada uno con su cuchillo', () => {
  const w = createWorld(5);
  expect(w.piles).toEqual([]);
  expect(w.blueprints).toEqual([]);
  // (Los fregaderos y las cisternas de los edificios, H5b, no se construyen.)
  expect(w.furniture.filter((f) => f.kind !== 'sink' && f.kind !== 'cistern')).toEqual([]);
  expect(w.chopMarks).toEqual([]);
  for (const s of w.survivors) {
    expect(s.equipped).toBe('knife'); // H4b: sin arma caían enseguida
    const coward = s.traits.includes('coward');
    expect(s.work).toEqual({
      heal: true, // H4e: Sanar, todos
      social: true,
      build: true,
      craft: true, // H4d: Fabricar, todos
      haul: true,
      chop: !coward,
      loot: !coward,
    });
  }
  expect(w.storage.items.wood).toBe(0);
});

test('invariantes: planos con madera de más, montones raros, marcas que no son árboles', () => {
  const w = createWorld(5);
  const floor = w.storage.tiles[0]!;
  w.woodLog.chopped = 6; // la madera del plano, como si se hubiera talado
  w.blueprints.push({ id: 90, kind: 'bed', pos: { ...floor }, wood: 7, progress: 0 });
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  w.blueprints[0]!.wood = 6;
  expect(checkInvariants(w)).toEqual([]);
  w.piles.push({
    id: 91,
    pos: { ...floor },
    items: {
      food: 0,
      bandage: 0,
      knife: 0,
      bat: 0,
      axe: 0,
      wood: -1,
      cloth: 0,
      curtains: 0,
      thread: 0,
      needle: 0,
      crowbar: 0,
      machete: 0,
      painkillers: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      pieces: [],
    },
  });
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  w.piles = [];
  w.chopMarks.push(floor.y * w.grid.width + floor.x);
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('una cama sin dueño es válida', () => {
  const w = createWorld(5);
  w.beds.push({ id: 50, pos: { x: 1, y: 1 }, ownerId: null });
  expect(checkInvariants(w)).toEqual([]);
});
