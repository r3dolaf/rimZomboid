// Mochilas y bolsas (spec H5b2): catálogo, huecos y lo que cabe.
import { BAGS, ITEM_WEIGHT_KG, KEEP_DEFAULT } from './balance';
import { emptyInventory, isBag, isEmpty, weightOf, type Inventory, type ItemKind } from './items';
import { capacityKg } from './skills';
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

/** Lo que una bolsa tiene de lo que pide su lista, hasta su cantidad (no se descarga, §3). */
export const reserved = (b: Bag, k: ItemKind): number => Math.min(b.items[k], b.list[k] ?? 0);

/** Cuántos `k` lleva en total: en las manos y en sus bolsas. */
export function has(s: Survivor, k: ItemKind): number {
  let n = s.carrying[k];
  for (const b of wornBags(s)) n += b.items[k];
  return n;
}

/** Lo suyo (para «Llevar siempre», §3): lo de las manos y lo no reservado de sus bolsas. */
export function personal(s: Survivor, k: ItemKind): number {
  let n = s.carrying[k];
  for (const b of wornBags(s)) n += b.items[k] - reserved(b, k);
  return n;
}

/**
 * Gasta hasta `n` (comer, vendar, dar…): primero lo de las manos, luego lo no reservado de sus
 * bolsas y por último lo reservado (§3). Devuelve cuántos ha gastado.
 */
export function spend(s: Survivor, k: ItemKind, n = 1): number {
  let left = n;
  const take = (inv: Inventory, max: number) => {
    const m = Math.min(left, max);
    inv[k] -= m;
    left -= m;
  };
  take(s.carrying, s.carrying[k]);
  for (const b of wornBags(s)) if (left > 0) take(b.items, b.items[k] - reserved(b, k));
  for (const b of wornBags(s)) if (left > 0) take(b.items, b.items[k]);
  return n - left;
}

/** Dónde va una `k` más (§3): la bolsa cuya lista la pide, si no la de más sitio, si no las manos. */
export function placeFor(s: Survivor, k: ItemKind): Inventory | null {
  const kg = ITEM_WEIGHT_KG[k];
  const bags = wornBags(s).filter((b) => bagRoom(b) + 1e-9 >= kg);
  const wanting = bags.find((b) => b.items[k] < (b.list[k] ?? 0));
  if (wanting) return wanting.items;
  let best: Bag | null = null;
  for (const b of bags) if (!best || bagRoom(b) > bagRoom(best)) best = b;
  if (best) return best.items;
  return weightOf(s.carrying) + kg <= capacityKg(s) + 1e-9 ? s.carrying : null;
}

/** Guarda una `k` donde quepa (`placeFor`); `false` si no le cabe. */
export function stashOne(s: Survivor, k: ItemKind): boolean {
  const inv = placeFor(s, k);
  if (!inv) return false;
  inv[k]++;
  return true;
}

/** ¿Lleva algo (en las manos o dentro de sus bolsas)? Con eso se aprende Transportar al andar. */
export const carriesSomething = (s: Survivor): boolean =>
  !isEmpty(s.carrying) || wornBags(s).some((b) => !isEmpty(b.items));
