// Atuendos (spec H5b §4): las prendas que puede ponerse cada colono y si acepta ropa de muertos.
import { DEFAULT_OUTFITS, NEW_OUTFIT_NAME, OUTFIT_NAME_MAX } from './balance';
import { BAG_KINDS } from './bags';
import { GARMENT_KINDS } from './clothes';
import type { Order } from './orders';
import type { Common, Garment, Outfit, Survivor, World } from './types';

/** Los atuendos de serie, con ids 1, 2, 3… */
export function defaultOutfits(): Outfit[] {
  return DEFAULT_OUTFITS.map((o, i) => ({
    id: i + 1,
    name: o.name,
    allowed:
      o.allowed === null ? [...GARMENT_KINDS] : GARMENT_KINDS.filter((k) => o.allowed!.includes(k)),
    dead: o.dead,
    bags: [...BAG_KINDS],
    handBag: o.handBag,
  }));
}

/** Su atuendo (o el primero, si el suyo ya no existe). */
export function outfitOf(w: World, s: Survivor): Outfit {
  return w.common.outfits.find((o) => o.id === s.outfitId) ?? w.common.outfits[0]!;
}

/** ¿Le deja su atuendo ponerse esa prenda? (La de un muerto, solo si acepta ropa de muertos.) */
export function allows(o: Outfit, g: Garment): boolean {
  return o.allowed.includes(g.kind) && (o.dead || g.from === null);
}

export type OutfitOrder = Extract<
  Order,
  {
    type:
      | 'addOutfit'
      | 'renameOutfit'
      | 'deleteOutfit'
      | 'setOutfitGarment'
      | 'setOutfitDead'
      | 'setOutfit'
      | 'setOutfitBag'
      | 'setOutfitHandBag';
  }
>;

export const isOutfitOrder = (o: Order): o is OutfitOrder =>
  o.type === 'addOutfit' ||
  o.type === 'renameOutfit' ||
  o.type === 'deleteOutfit' ||
  o.type === 'setOutfitGarment' ||
  o.type === 'setOutfitDead' ||
  o.type === 'setOutfit' ||
  o.type === 'setOutfitBag' ||
  o.type === 'setOutfitHandBag';

/** Lo que tocan las órdenes de atuendos (el mundo, o una copia para la interfaz). */
type OutfitState = {
  common: Pick<Common, 'outfits' | 'nextOutfitId'>;
  survivors: Survivor[];
};

/** Aplica una orden de atuendos. */
export function applyOutfitOrder(w: OutfitState, o: OutfitOrder): void {
  if (o.type === 'addOutfit') {
    const id = w.common.nextOutfitId++;
    w.common.outfits.push({
      id,
      name: `${NEW_OUTFIT_NAME} ${id}`,
      allowed: [...GARMENT_KINDS],
      dead: false,
      bags: [...BAG_KINDS],
      handBag: true,
    });
    return;
  }
  if (o.type === 'setOutfit') {
    const s = w.survivors.find((x) => x.id === o.survivorId);
    if (s && w.common.outfits.some((x) => x.id === o.outfitId)) s.outfitId = o.outfitId;
    return;
  }
  const outfit = w.common.outfits.find((x) => x.id === o.outfitId);
  if (!outfit) return;
  switch (o.type) {
    case 'renameOutfit': {
      const name = o.name.trim().slice(0, OUTFIT_NAME_MAX);
      if (name) outfit.name = name;
      break;
    }
    case 'deleteOutfit': {
      if (w.common.outfits.length <= 1) break;
      w.common.outfits = w.common.outfits.filter((x) => x !== outfit);
      for (const s of w.survivors)
        if (s.outfitId === outfit.id) s.outfitId = w.common.outfits[0]!.id;
      break;
    }
    case 'setOutfitGarment': {
      const on = new Set(outfit.allowed);
      if (o.on) on.add(o.garment);
      else on.delete(o.garment);
      outfit.allowed = GARMENT_KINDS.filter((k) => on.has(k));
      break;
    }
    case 'setOutfitDead':
      outfit.dead = o.on;
      break;
    case 'setOutfitBag': {
      const on = new Set(outfit.bags);
      if (o.on) on.add(o.bag);
      else on.delete(o.bag);
      outfit.bags = BAG_KINDS.filter((k) => on.has(k));
      break;
    }
    case 'setOutfitHandBag':
      outfit.handBag = o.on;
      break;
  }
}

/** Los atuendos con las órdenes pendientes ya aplicadas (copia: el mundo no cambia). */
export function effectiveOutfits(w: World): Outfit[] {
  const copy: OutfitState = {
    common: { outfits: structuredClone(w.common.outfits), nextOutfitId: w.common.nextOutfitId },
    survivors: w.survivors.map((s) => ({ ...s })),
  };
  for (const o of w.orders) if (isOutfitOrder(o)) applyOutfitOrder(copy, o);
  return copy.common.outfits;
}
