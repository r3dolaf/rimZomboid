// Rellenar (spec H5b2 §3): lo que le falta a cada uno (su «Llevar siempre» y las listas de sus
// bolsas puestas) y las bolsas guardadas en el almacén, que llena Transportar.
import { ITEM_WEIGHT_KG } from '../balance';
import { bagRoom, bagsIn, personal, placeFor, wornBags } from '../bags';
import { ITEM_KINDS, type ItemKind } from '../items';
import { pick } from '../rng';
import type { Action, Bag, Survivor, World } from '../types';
import { inBase, reachesStorage } from './medical';

const fits = (b: Bag, k: ItemKind) => bagRoom(b) + 1e-9 >= ITEM_WEIGHT_KG[k];
/** Lo que le falta a la lista de una bolsa. */
const deficit = (b: Bag, k: ItemKind) => Math.max(0, (b.list[k] ?? 0) - b.items[k]);
const lacking = (s: Survivor, k: ItemKind) => personal(s, k) < (s.keep[k] ?? 0);

/** ¿Hay en el almacén algo que le falte y le quepa? */
function wantsSupplies(s: Survivor, w: World): boolean {
  const store = w.storage.items;
  return ITEM_KINDS.some(
    (k) =>
      store[k] > 0 &&
      (wornBags(s).some((b) => deficit(b, k) > 0 && fits(b, k)) ||
        (lacking(s, k) && placeFor(s, k) !== null)),
  );
}

/** En la base, si le falta algo que hay en el almacén y le cabe, va a por ello (como las vendas). */
export function supplyJob(s: Survivor, w: World): Action | null {
  if (!inBase(w, s) || !reachesStorage(w, s) || !wantsSupplies(s, w)) return null;
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'takeSupplies' } };
}

/** En el almacén: primero lo que les falta a las listas de sus bolsas; luego lo suyo. */
export function takeSupplies(s: Survivor, w: World): void {
  const store = w.storage.items;
  for (const b of wornBags(s))
    for (const k of ITEM_KINDS)
      while (store[k] > 0 && deficit(b, k) > 0 && fits(b, k)) {
        store[k]--;
        b.items[k]++;
      }
  for (const k of ITEM_KINDS)
    while (store[k] > 0 && lacking(s, k)) {
      const to = placeFor(s, k);
      if (!to) break;
      to[k]++;
      store[k]--;
    }
}

/** La bolsa guardada a la que va a llenar, o `null`. */
export function packTarget(s: Survivor): number | null {
  const a = s.action;
  return a.type === 'moveTo' && a.then?.type === 'packBag' ? a.then.pieceId : null;
}

/** ¿Le falta algo de su lista que haya en el almacén y le quepa? */
const needsPacking = (w: World, b: Bag) =>
  ITEM_KINDS.some((k) => deficit(b, k) > 0 && w.storage.items[k] > 0 && fits(b, k));

const storedBag = (w: World, id: number) => bagsIn(w.storage.items.pieces).find((b) => b.id === id);

/** Transportar: una bolsa guardada con lista a la que le falta algo (la que nadie esté llenando). */
export function packJob(s: Survivor, w: World): Action | null {
  if (!reachesStorage(w, s)) return null;
  const claimed = new Set(w.survivors.filter((o) => o !== s).map(packTarget));
  const b = bagsIn(w.storage.items.pieces).find((x) => !claimed.has(x.id) && needsPacking(w, x));
  if (!b) return null;
  return {
    type: 'moveTo',
    target: pick(w.rng, w.storage.tiles),
    then: { type: 'packBag', pieceId: b.id },
  };
}

export function packStillWorth(w: World, pieceId: number): boolean {
  const b = storedBag(w, pieceId);
  return b !== undefined && needsPacking(w, b);
}

/** En el almacén: mete en la bolsa lo que le falte de su lista (lo que haya y quepa). */
export function startPackBag(_s: Survivor, w: World, pieceId: number): Action {
  const b = storedBag(w, pieceId);
  const store = w.storage.items;
  if (b)
    for (const k of ITEM_KINDS)
      while (store[k] > 0 && deficit(b, k) > 0 && fits(b, k)) {
        store[k]--;
        b.items[k]++;
      }
  return { type: 'idle', ticksLeft: 0 };
}
