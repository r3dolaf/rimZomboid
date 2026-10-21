// Montones de objetos en el suelo (spec H4a §2.2).
import { addInto, emptyInventory, isEmpty, type Inventory } from './items';
import { inBounds, isWalkable } from './map/grid';
import type { Pile, Point, World } from './types';

/** El montón de esa casilla, si hay. */
export function pileAt(w: World, x: number, y: number): Pile | undefined {
  return w.piles.find((p) => p.pos.x === x && p.pos.y === y);
}

/**
 * Deja `items` en el suelo en `pos` (o, si no es transitable, en la casilla transitable más
 * cercana), sumándolos al montón que ya hubiera. Vacía `items`.
 */
export function dropPile(w: World, pos: Point, items: Inventory): void {
  if (isEmpty(items)) return;
  const spot = walkableNear(w, pos);
  if (!spot) throw new Error('dropPile: no queda ninguna casilla transitable en el mapa');
  let pile = pileAt(w, spot.x, spot.y);
  if (!pile) {
    pile = { id: w.nextId++, pos: spot, items: emptyInventory() };
    w.piles.push(pile);
  }
  addInto(pile.items, items);
}

/**
 * `pos` si es transitable; si no, la primera que lo sea en anillos cada vez más anchos a su
 * alrededor (primero las 8 vecinas, luego las de 2 casillas…).
 */
export function walkableNear(w: World, pos: Point): Point | null {
  if (isWalkable(w.grid, pos.x, pos.y)) return { ...pos };
  const max = Math.max(w.grid.width, w.grid.height);
  for (let r = 1; r <= max; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (inBounds(w.grid, x, y) && isWalkable(w.grid, x, y)) return { x, y };
      }
  return null;
}

/** Quita los montones vacíos. */
export function prunePiles(w: World): void {
  if (w.piles.some((p) => isEmpty(p.items))) w.piles = w.piles.filter((p) => !isEmpty(p.items));
}
