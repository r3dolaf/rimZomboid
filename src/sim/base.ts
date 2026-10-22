// La base: su suelo y dónde van las camas y el almacén.
import { BED_SLOTS, STORAGE_SLOTS } from './balance';
import { getTile } from './map/grid';
import { doorSide, frameOf } from './map/recipes';
import { Tile, type Building, type Point, type World } from './types';

/**
 * Sitios de cama y del almacén de la base (spec H2 §7), girados según hacia dónde mire su puerta
 * (H4f): las camas al fondo y el almacén junto a la puerta.
 */
export function baseLayout(base: Building): { beds: Point[]; storage: Point[] } {
  const f = frameOf(base.rect, doorSide(base));
  // Los sitios están medidos con la puerta abajo: dy desde el muro del fondo, dx de lado a lado.
  const at = (s: { dx: number; dy: number }) => f.at(f.depth - 1 - s.dy, s.dx);
  return { beds: BED_SLOTS.map(at), storage: STORAGE_SLOTS.map(at) };
}

/** Las casillas de suelo de la base (donde se pasea, se duerme sin cama o se refugia). */
export function baseFloor(w: World): Point[] {
  const { x, y, w: width, h } = w.base.rect;
  const out: Point[] = [];
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + width; i++)
      if (getTile(w.grid, i, j) === Tile.Floor) out.push({ x: i, y: j });
  return out;
}
