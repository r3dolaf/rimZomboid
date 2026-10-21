// Montones de objetos en el suelo (spec H4a §2.2).
import { addInto, emptyInventory, isEmpty, type Inventory } from './items';
import { inBounds, isWalkable } from './map/grid';
import type { Pile, Point, World } from './types';

/** El montón de esa casilla, si hay. */
export function pileAt(w: World, x: number, y: number): Pile | undefined {
  return w.piles.find((p) => p.pos.x === x && p.pos.y === y);
}

/**
 * Deja `items` en el suelo en `pos` (o, si no es transitable, en la primera casilla transitable
 * de al lado), sumándolos al montón que ya hubiera. Vacía `items`.
 */
export function dropPile(w: World, pos: Point, items: Inventory): void {
  if (isEmpty(items)) return;
  const spot = walkableNear(w, pos);
  if (!spot) return; // no puede pasar: siempre hay alguna casilla transitable cerca
  let pile = pileAt(w, spot.x, spot.y);
  if (!pile) {
    pile = { id: w.nextId++, pos: spot, items: emptyInventory() };
    w.piles.push(pile);
  }
  addInto(pile.items, items);
}

/** `pos` si es transitable; si no, la primera vecina (en las 8 direcciones) que lo sea. */
export function walkableNear(w: World, pos: Point): Point | null {
  if (isWalkable(w.grid, pos.x, pos.y)) return { ...pos };
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
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
