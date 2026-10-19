import { Tile, type Grid } from '../types';

export function createGrid(width: number, height: number, fill: Tile): Grid {
  return { width, height, tiles: new Array<Tile>(width * height).fill(fill) };
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
}

const WALKABLE: ReadonlySet<Tile> = new Set([Tile.Grass, Tile.Floor, Tile.Road, Tile.Door]);

export function isWalkable(g: Grid, x: number, y: number): boolean {
  return WALKABLE.has(getTile(g, x, y));
}
