import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from './balance';
import { createGrid, setTile } from './map/grid';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Grid } from './types';
import { computeFov, visibleTiles, visionRadius, visionSystem } from './vision';
import { createWorld } from './world';

const at = (hour: number) => ((hour - 8 + 24) % 24) * TICKS_PER_HOUR;

function fov(g: Grid, x: number, y: number, r: number): Set<string> {
  const seen = new Set<string>();
  computeFov(g, x, y, r, (a, b) => seen.add(`${a},${b}`));
  return seen;
}

test('en campo abierto se ve hasta el radio y no más', () => {
  const v = fov(createGrid(40, 40, Tile.Grass), 20, 20, 12);
  expect(v.has('20,20')).toBe(true);
  expect(v.has('32,20')).toBe(true);
  expect(v.has('33,20')).toBe(false);
  expect(v.has('28,28')).toBe(true); // distancia 11,3
  expect(v.has('29,29')).toBe(false); // distancia 12,7
});

test.each([
  [Tile.Wall, false],
  [Tile.Tree, false],
  [Tile.Door, false],
  [Tile.Window, true],
])('una columna de %i deja ver detrás: %s', (tile, seesBehind) => {
  const g = createGrid(20, 11, Tile.Grass);
  for (let y = 0; y < 11; y++) setTile(g, 7, y, Tile.Wall);
  setTile(g, 7, 5, tile);
  const v = fov(g, 5, 5, 10);
  expect(v.has('7,5')).toBe(true); // lo que tapa también se ve
  expect(v.has('9,5')).toBe(seesBehind);
});

test('una habitación cerrada no se ve desde fuera', () => {
  const g = createGrid(20, 20, Tile.Grass);
  for (let i = 8; i <= 12; i++) {
    setTile(g, i, 8, Tile.Wall);
    setTile(g, i, 12, Tile.Wall);
    setTile(g, 8, i, Tile.Wall);
    setTile(g, 12, i, Tile.Wall);
  }
  const v = fov(g, 2, 10, 15);
  for (let y = 9; y <= 11; y++)
    for (let x = 9; x <= 11; x++) expect(v.has(`${x},${y}`)).toBe(false);
});

test('en los bordes del mapa no se sale de él', () => {
  const g = createGrid(10, 10, Tile.Grass);
  const v = fov(g, 0, 0, 12);
  for (const k of v) {
    const [x, y] = k.split(',').map(Number);
    expect(x! >= 0 && y! >= 0 && x! < 10 && y! < 10).toBe(true);
  }
  expect(v.has('9,0')).toBe(true);
});

test('radio: 12 de día, 6 de noche y entre medias al atardecer', () => {
  expect(visionRadius(at(12))).toBe(12);
  expect(visionRadius(at(23))).toBe(6);
  expect(visionRadius(at(3))).toBe(6);
  expect(visionRadius(at(20))).toBe(9);
  expect(visionRadius(at(6))).toBe(9);
});

test('el mundo empieza conociendo la base y no las casas lejanas', () => {
  const w = createWorld(4);
  const idx = (x: number, y: number) => y * w.grid.width + x;
  for (const s of w.survivors)
    expect(w.seen[idx(Math.floor(s.pos.x), Math.floor(s.pos.y))]).toBe(1);
  const far = [...w.houses].sort(
    (a, b) =>
      Math.abs(b.door.x - 50) +
      Math.abs(b.door.y - 50) -
      (Math.abs(a.door.x - 50) + Math.abs(a.door.y - 50)),
  )[0]!;
  const cx = far.rect.x + Math.floor(far.rect.w / 2);
  const cy = far.rect.y + 1;
  expect(w.seen[idx(cx, cy)]).toBe(0);
});

test('lo visto se recuerda aunque ya no se vea; lo visible depende de dónde están', () => {
  const w = emptyWorld(40, 40);
  w.seen = new Array(40 * 40).fill(0);
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  visionSystem(w);
  expect(w.seen[5 * 40 + 15]).toBe(1);
  s.pos = { x: 35.5, y: 35.5 };
  w.tick = 5;
  visionSystem(w);
  expect(w.seen[5 * 40 + 15]).toBe(1);
  const vis = visibleTiles(w);
  expect(vis[5 * 40 + 15]).toBe(0);
  expect(vis[35 * 40 + 35]).toBe(1);
});

test('la visión se actualiza cada 5 ticks', () => {
  const w = emptyWorld(40, 40);
  w.seen = new Array(40 * 40).fill(0);
  w.tick = 3;
  visionSystem(w);
  expect(w.seen.some((v) => v === 1)).toBe(false);
  w.tick = 5;
  visionSystem(w);
  expect(w.seen.some((v) => v === 1)).toBe(true);
});
