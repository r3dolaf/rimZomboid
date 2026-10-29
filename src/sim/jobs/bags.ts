// Ponerse las bolsas (spec H5b2 §2): en cada hueco, la de más capacidad que permita su atuendo, en
// el almacén; lo que su atuendo ya no permite, se lo quita (salvo los huecos fijados).
import { BAGS, DRESS_TICKS } from '../balance';
import { BAG_SLOTS, bagAllowed, bagsIn, settleBag, unloadAt } from '../bags';
import { canWalk } from '../body';
import { logEvent } from '../log';
import { regionOf } from '../path/astar';
import { prunePiles } from '../piles';
import { pick } from '../rng';
import { tileOf } from '../world';
import { atOrBeside } from './stand';
import type { Action, Bag, BagSlot, Survivor, World } from '../types';
import { takeSupplies } from './supplies';

/** Un cambio en un hueco: ponerse `put` (o nada) y quitarse lo que hubiera. */
type BagChange = { slot: BagSlot; put: Bag | null };

const capacity = (b: Bag | null) => (b ? BAGS[b.kind].capacity : 0);

/** Lo siguiente que haría en el almacén, o `null` si ya va como debe. */
function nextBagChange(s: Survivor, w: World): BagChange | null {
  const free = (slot: BagSlot) => !s.bagsPinned.includes(slot);
  for (const slot of BAG_SLOTS) {
    const b = s.bags[slot];
    if (b && free(slot) && !bagAllowed(w, s, b.kind, slot)) return { slot, put: null };
  }
  const stored = bagsIn(w.storage.items.pieces);
  if (stored.length === 0) return null;
  // Por huecos (cintura, espalda, mano): así la de deporte va a la espalda si allí no hay nada
  // mejor y, si no, a la mano.
  for (const slot of BAG_SLOTS) {
    if (!free(slot)) continue;
    let best: Bag | null = null;
    for (const b of stored)
      if (
        BAGS[b.kind].slots.includes(slot) &&
        bagAllowed(w, s, b.kind, slot) &&
        capacity(b) > capacity(best ?? s.bags[slot])
      )
        best = b;
    if (best) return { slot, put: best };
  }
  return null;
}

const wantsBags = (s: Survivor, w: World) => !s.drafted && nextBagChange(s, w) !== null;

/** Si en el almacén hay una bolsa mejor (o lleva una que no toca), va. */
export function bagJob(s: Survivor, w: World): Action | null {
  if (!wantsBags(s, w)) return null;
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'bags' } };
}

export function bagStillWorth(s: Survivor): boolean {
  return !s.drafted;
}

/**
 * En el almacén: descarga, se cambia de bolsas (la quitada se queda allí con lo de su lista) y
 * vuelve a coger lo que le falte; tarda 5 minutos por bolsa puesta o quitada.
 */
export function startBags(s: Survivor, w: World): Action {
  unloadAt(w, s);
  let changes = 0;
  for (let i = 0; i < BAG_SLOTS.length * 2; i++) {
    const c = nextBagChange(s, w);
    if (!c) break;
    const off = s.bags[c.slot];
    if (off) {
      w.storage.items.pieces.push(off);
      settleBag(w, off);
      changes++;
    }
    s.bags[c.slot] = c.put;
    if (c.put) {
      w.storage.items.pieces = w.storage.items.pieces.filter((p) => p !== c.put);
      changes++;
    }
  }
  takeSupplies(s, w);
  return changes > 0
    ? { type: 'dress', ticksLeft: changes * DRESS_TICKS }
    : { type: 'idle', ticksLeft: 0 };
}

/** El montón donde está su bolsa soltada, o `undefined`. */
const pileWith = (w: World, bagId: number) =>
  w.piles.find((p) => p.items.pieces.some((x) => x.id === bagId));

/**
 * Su bolsa soltada (§5): si está bien, tiene la mano libre y llega, va primero a por ella. Si ya no
 * está en el suelo (se la ha llevado otro), se olvida de ella.
 */
export function recoverBagJob(s: Survivor, w: World): Action | null {
  if (s.droppedBag === null) return null;
  const pile = pileWith(w, s.droppedBag);
  if (!pile) {
    // Se la ha llevado otro: el hueco deja de estar fijado (si no, no volvería a llevar ninguna).
    s.droppedBag = null;
    s.bagsPinned = s.bagsPinned.filter((x) => x !== 'hand');
    return null;
  }
  if (s.bags.hand !== null || s.drafted || !canWalk(s)) return null;
  const at = tileOf(s.pos);
  if (regionOf(w.grid, at.x, at.y) !== regionOf(w.grid, pile.pos.x, pile.pos.y)) return null;
  return { type: 'moveTo', target: { ...pile.pos }, then: { type: 'pickUpBag', pileId: pile.id } };
}

/** Al llegar al montón: se pone su bolsa en la mano. */
export function pickUpBag(s: Survivor, w: World, pileId: number): Action {
  const pile = w.piles.find((p) => p.id === pileId);
  const b = pile && bagsIn(pile.items.pieces).find((x) => x.id === s.droppedBag);
  if (pile && b && s.bags.hand === null && atOrBeside(s, pile.pos)) {
    pile.items.pieces = pile.items.pieces.filter((x) => x !== b);
    s.bags.hand = b;
    s.droppedBag = null;
    w.common.bagLog.recovered++;
    logEvent(w, { kind: 'bagRecovered', survivorId: s.id, bag: b.kind });
    prunePiles(w);
  }
  return { type: 'idle', ticksLeft: 0 };
}
