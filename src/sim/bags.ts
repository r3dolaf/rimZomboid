// Mochilas y bolsas (spec H5b2): catálogo, huecos y lo que cabe.
import { BAGS, KEEP_DEFAULT } from './balance';
import { emptyInventory, isBag, weightOf } from './items';
import type { PieceCounter } from './clothes';
import type { Bag, BagKind, BagSlot, Garment, Piece, Survivor } from './types';

export { isBag };

/** Los huecos, en el orden de la ficha. */
export const BAG_SLOTS: readonly BagSlot[] = ['waist', 'back', 'hand'];

/** Todas las bolsas, en el orden del catálogo (de menos a más capacidad, salvo la riñonera). */
export const BAG_KINDS = Object.keys(BAGS) as BagKind[];

/** Una bolsa nueva, vacía y sin lista (se apunta en las cuentas de las piezas). */
export function newBag(w: PieceCounter, kind: BagKind): Bag {
  w.pieceLog.made++;
  return { id: w.nextPieceId++, kind, items: emptyInventory(), list: {} };
}

/** Las prendas de una lista de piezas (sin las bolsas). */
export const garments = (list: readonly Piece[]): Garment[] =>
  list.filter((p): p is Garment => !isBag(p));

/** Las bolsas de una lista de piezas. */
export const bagsIn = (list: readonly Piece[]): Bag[] => list.filter(isBag);

/** Las bolsas que lleva puestas, por orden de hueco. */
export function wornBags(s: Survivor): Bag[] {
  const out: Bag[] = [];
  for (const slot of BAG_SLOTS) {
    const b = s.bags[slot];
    if (b) out.push(b);
  }
  return out;
}

/** Los kilos que le caben aún (en kilos reales). */
export const bagRoom = (b: Bag): number => BAGS[b.kind].capacity - weightOf(b.items);

/** Sin bolsas puestas. */
export const noBags = (): Record<BagSlot, Bag | null> => ({ waist: null, back: null, hand: null });

/** Lo de bolsas de alguien que llega (colono o desconocido): sin bolsas y su «Llevar siempre». */
export const bagFields = (): Pick<Survivor, 'bags' | 'keep' | 'bagsPinned' | 'droppedBag'> => ({
  bags: noBags(),
  keep: { ...KEEP_DEFAULT },
  bagsPinned: [],
  droppedBag: null,
});
