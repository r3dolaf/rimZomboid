import { Tile, type Grid } from '../types';
import { regionCache } from './regionCache';

export function createGrid(width: number, height: number, fill: Tile): Grid {
  return { width, height, tiles: new Array<Tile>(width * height).fill(fill), version: 0 };
}

export function inBounds(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.width && y < g.height;
}

/** Fuera del mapa se comporta como un muro. */
export function getTile(g: Grid, x: number, y: number): Tile {
  if (!inBounds(g, x, y)) return Tile.Wall;
  return g.tiles[y * g.width + x]!;
}

export function setTile(g: Grid, x: number, y: number, t: Tile): void {
  if (!inBounds(g, x, y)) throw new Error(`setTile fuera del mapa: (${x}, ${y})`);
  g.tiles[y * g.width + x] = t;
  g.version++;
  regionCache.delete(g);
}

const WALKABLE: ReadonlySet<Tile> = new Set([
  Tile.Grass,
  Tile.Floor,
  Tile.Road,
  Tile.Door,
  Tile.BrokenWindow,
  Tile.BrokenDoor,
  Tile.Rubble,
]);

export function isWalkable(g: Grid, x: number, y: number): boolean {
  return WALKABLE.has(getTile(g, x, y));
}

/** Lo que pisa un zombi: como los colonos, pero una puerta (cerrada) es un obstáculo. */
const ZOMBIE_WALKABLE: ReadonlySet<Tile> = new Set([
  Tile.Grass,
  Tile.Floor,
  Tile.Road,
  Tile.BrokenWindow,
  Tile.BrokenDoor,
  Tile.Rubble,
]);

export function isZombieWalkable(g: Grid, x: number, y: number): boolean {
  return ZOMBIE_WALKABLE.has(getTile(g, x, y));
}
