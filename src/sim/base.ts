// La base: su suelo.
import { getTile } from './map/grid';
import { Tile, type Point, type World } from './types';

/** Las casillas de suelo de la base (donde se pasea, se duerme sin cama o se refugia). */
export function baseFloor(w: World): Point[] {
  const { x, y, w: width, h } = w.base.rect;
  const out: Point[] = [];
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + width; i++)
      if (getTile(w.grid, i, j) === Tile.Floor) out.push({ x: i, y: j });
  return out;
}
