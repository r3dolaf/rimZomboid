// Mochilas y bolsas (spec H5b2): catálogo, huecos y lo que cabe.
import { BAGS, ITEM_WEIGHT_KG, KEEP_DEFAULT } from './balance';
import {
  addInto,
  emptyInventory,
  isBag,
  isEmpty,
  ITEM_KINDS,
  pieceKg,
  weightOf,
  type Inventory,
  type ItemKind,
} from './items';
import { logEvent } from './log';
import { dropPile } from './piles';
import { capacityKg } from './skills';
import type { PieceCounter } from './clothes';
import type { Bag, BagKind, BagSlot, Garment, Piece, Survivor, World } from './types';

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

/** ¿Le cabe en las manos? */
const fitsHands = (s: Survivor, kg: number) => weightOf(s.carrying) + kg <= capacityKg(s) + 1e-9;

/** ¿Permite su atuendo esa bolsa en ese hueco? (Su atuendo, o el primero si ya no existe.) */
export function bagAllowed(w: World, s: Survivor, kind: BagKind, slot: BagSlot): boolean {
  const o = w.outfits.find((x) => x.id === s.outfitId) ?? w.outfits[0];
  return !o || (o.bags.includes(kind) && (slot !== 'hand' || o.handBag));
}

/**
 * Un hueco libre donde ponerse la bolsa: al saquear, uno que le vale y que su atuendo permite (la
 * espalda antes que la mano); al transportar, la mano, sin mirar el atuendo (§5).
 */
function freeSlotFor(w: World, s: Survivor, b: Bag, mode: 'loot' | 'haul'): BagSlot | null {
  for (const slot of BAGS[b.kind].slots) {
    if (s.bags[slot] !== null) continue;
    if (mode === 'haul' ? slot === 'hand' : bagAllowed(w, s, b.kind, slot)) return slot;
  }
  return null;
}

/** Dónde va una prenda: la bolsa con más sitio, si no las manos. */
function placeForPiece(s: Survivor, kg: number): Inventory | null {
  let best: Bag | null = null;
  for (const b of wornBags(s))
    if (bagRoom(b) + 1e-9 >= kg && (!best || bagRoom(b) > bagRoom(best))) best = b;
  if (best) return best.items;
  return fitsHands(s, kg) ? s.carrying : null;
}

/**
 * Coge de `from` lo que pueda (spec §2, §3): primero las bolsas (se la pone si puede; si no, entera
 * a las manos si cabe; si no, la vacía allí mismo y la bolsa vacía se mira al final), luego los
 * montones (a la bolsa cuya lista los pide, a la de más sitio, a las manos) y luego las prendas.
 * Devuelve lo cogido (las mismas piezas, no copias).
 */
export function takeInto(w: World, s: Survivor, from: Inventory, mode: 'loot' | 'haul'): Inventory {
  const taken = emptyInventory();
  const takePiece = (p: Piece, to: Inventory) => {
    from.pieces = from.pieces.filter((x) => x !== p);
    to.pieces.push(p);
    taken.pieces.push(p);
  };
  for (const b of bagsIn(from.pieces)) {
    const slot = freeSlotFor(w, s, b, mode);
    if (slot) {
      from.pieces = from.pieces.filter((x) => x !== b);
      s.bags[slot] = b;
      taken.pieces.push(b);
      if (mode === 'haul') s.haulingBag = b.id; // para dejarla en el almacén
      if (mode === 'loot') {
        w.bagLog.found++;
        logEvent(w, { kind: 'bagFound', survivorId: s.id, bag: b.kind });
      }
    } else if (fitsHands(s, pieceKg(b))) takePiece(b, s.carrying);
    else addInto(from, b.items); // la vacía allí mismo
  }
  for (const k of ITEM_KINDS)
    while (from[k] > 0) {
      const to = placeFor(s, k);
      if (!to) break;
      to[k]++;
      from[k]--;
      taken[k]++;
    }
  for (const p of [...from.pieces]) {
    // Las bolsas (ya vacías) no van dentro de otra: a las manos, si caben.
    const to = isBag(p)
      ? fitsHands(s, pieceKg(p))
        ? s.carrying
        : null
      : placeForPiece(s, pieceKg(p));
    if (to) takePiece(p, to);
  }
  return taken;
}

/** Una bolsa que entra en el almacén suelta en él lo que no está en su lista (§3). */
export function settleBag(w: World, b: Bag): void {
  const store = w.storage.items;
  for (const k of ITEM_KINDS) {
    const out = b.items[k] - reserved(b, k);
    b.items[k] -= out;
    store[k] += out;
  }
  store.pieces.push(...b.items.pieces);
  b.items.pieces = [];
}

/**
 * Descarga en el almacén (§3): de cada bolsa puesta, todo menos lo reservado; de las manos, todo.
 * Con lo que sale llena primero lo que les falta a las listas de sus bolsas, luego se queda con su
 * «Llevar siempre» (en una bolsa si cabe, si no en las manos) y lo demás va al almacén. Las bolsas
 * que lleva en las manos, y las puestas que su atuendo no permite (sin fijar), se quedan allí.
 */
export function unloadAt(w: World, s: Survivor): void {
  const pool = emptyInventory();
  for (const b of wornBags(s)) {
    for (const k of ITEM_KINDS) {
      const out = b.items[k] - reserved(b, k);
      b.items[k] -= out;
      pool[k] += out;
    }
    pool.pieces.push(...b.items.pieces);
    b.items.pieces = [];
  }
  addInto(pool, s.carrying);
  for (const slot of BAG_SLOTS) {
    const b = s.bags[slot];
    if (!b) continue;
    const hauled = b.id === s.haulingBag;
    if (!hauled && (s.bagsPinned.includes(slot) || bagAllowed(w, s, b.kind, slot))) continue;
    s.bags[slot] = null;
    pool.pieces.push(b);
  }
  delete s.haulingBag;
  // Lo que les falta a las listas.
  for (const b of wornBags(s))
    for (const k of ITEM_KINDS) {
      const kg = ITEM_WEIGHT_KG[k];
      while (pool[k] > 0 && b.items[k] < (b.list[k] ?? 0) && bagRoom(b) + 1e-9 >= kg) {
        pool[k]--;
        b.items[k]++;
      }
    }
  // Su «Llevar siempre».
  for (const k of ITEM_KINDS) {
    let n = Math.min(s.keep[k] ?? 0, pool[k]);
    for (; n > 0; n--) {
      const to = placeFor(s, k);
      if (!to) break;
      to[k]++;
      pool[k]--;
    }
  }
  const store = w.storage.items;
  for (const b of bagsIn(pool.pieces)) {
    pool.pieces = pool.pieces.filter((x) => x !== b);
    store.pieces.push(b);
    settleBag(w, b);
  }
  addInto(store, pool);
}

/** ¿Tiene algo que descargar? Prendas, o más de lo suyo que su «Llevar siempre» (§3). */
export function unloadable(s: Survivor): boolean {
  if (s.carrying.pieces.length > 0 || wornBags(s).some((b) => b.items.pieces.length > 0))
    return true;
  return ITEM_KINDS.some((k) => personal(s, k) > (s.keep[k] ?? 0));
}

/** Una bolsa de un colono (puesta) o del almacén, por su id. */
export function findBag(w: World, id: number): Bag | undefined {
  for (const s of w.survivors) for (const b of wornBags(s)) if (b.id === id) return b;
  return bagsIn(w.storage.items.pieces).find((b) => b.id === id);
}

/** Cantidad válida para una lista (0 la quita). */
const validN = (n: number) => Number.isInteger(n) && n >= 0 && n <= 99;

/** Pone `n` de `item` en una lista (0 la quita). */
function setCount(list: Partial<Record<ItemKind, number>>, item: ItemKind, n: number): void {
  if (n === 0) delete list[item];
  else list[item] = n;
}

export type BagListOrder =
  | { type: 'setBagList'; pieceId: number; item: ItemKind; n: number }
  | { type: 'setKeep'; survivorId: number; item: ItemKind; n: number }
  /** Fijar la bolsa de un hueco desde la ficha (§2). */
  | { type: 'pinBag'; survivorId: number; slot: BagSlot; on: boolean };

/** Fija o suelta un hueco. */
function setPinned(pinned: BagSlot[], slot: BagSlot, on: boolean): BagSlot[] {
  const set = new Set(pinned);
  if (on) set.add(slot);
  else set.delete(slot);
  return BAG_SLOTS.filter((x) => set.has(x));
}

/** Aplica una orden de listas o de fijar (§2, §3); las que no valen no hacen nada. */
export function applyBagListOrder(w: World, o: BagListOrder): void {
  if (o.type === 'pinBag') {
    const s = w.survivors.find((x) => x.id === o.survivorId);
    if (s && BAG_SLOTS.includes(o.slot)) s.bagsPinned = setPinned(s.bagsPinned, o.slot, o.on);
    return;
  }
  if (!validN(o.n) || !ITEM_KINDS.includes(o.item)) return;
  if (o.type === 'setBagList') {
    const b = findBag(w, o.pieceId);
    if (b) setCount(b.list, o.item, o.n);
    return;
  }
  const s = w.survivors.find((x) => x.id === o.survivorId);
  if (s) setCount(s.keep, o.item, o.n);
}

/** La lista de una bolsa con las órdenes pendientes ya aplicadas (copia). */
export function effectiveList(w: World, b: Bag): Partial<Record<ItemKind, number>> {
  const list = { ...b.list };
  for (const o of w.orders)
    if (o.type === 'setBagList' && o.pieceId === b.id && validN(o.n)) setCount(list, o.item, o.n);
  return list;
}

/** Su «Llevar siempre» con las órdenes pendientes ya aplicadas (copia). */
export function effectiveKeep(w: World, s: Survivor): Partial<Record<ItemKind, number>> {
  const keep = { ...s.keep };
  for (const o of w.orders)
    if (o.type === 'setKeep' && o.survivorId === s.id && validN(o.n)) setCount(keep, o.item, o.n);
  return keep;
}

/** Sus huecos fijados con las órdenes pendientes ya aplicadas. */
export function effectivePinned(w: World, s: Survivor): BagSlot[] {
  let pinned = s.bagsPinned;
  for (const o of w.orders)
    if (o.type === 'pinBag' && o.survivorId === s.id) pinned = setPinned(pinned, o.slot, o.on);
  return pinned;
}

/**
 * Suelta la bolsa de la mano en el suelo con todo dentro (§4, §5): al pelear con el hacha de talar,
 * derribado o huyendo. Se acuerda de ella para ir a por ella.
 */
export function dropHandBag(w: World, s: Survivor): void {
  const b = s.bags.hand;
  if (!b) return;
  s.bags.hand = null;
  dropPile(
    w,
    { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) },
    { ...emptyInventory(), pieces: [b] },
  );
  s.droppedBag = b.id;
  w.bagLog.dropped++;
  logEvent(w, { kind: 'bagDropped', survivorId: s.id, bag: b.kind });
}
