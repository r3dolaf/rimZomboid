import { BAGS, GARMENTS, ITEM_WEIGHT_KG } from './balance';
import type { Bag, Piece } from './types';

export type ItemKind =
  | 'food'
  | 'bandage'
  | 'knife'
  | 'bat'
  | 'axe'
  | 'wood'
  // Tela, cortinas y armas nuevas (H4d). El hilo se cuenta en usos.
  | 'cloth'
  | 'curtains'
  | 'thread'
  | 'needle'
  | 'crowbar'
  | 'machete'
  // H5
  | 'painkillers'
  // H5b: retal de vaquero, tira de cuero, cubos y botellas de agua.
  | 'denim'
  | 'leather'
  | 'bucket'
  | 'waterBucket'
  | 'waterBottle'
  // H5b2
  | 'hatchet'
  // H5c1: un mapa de carreteras y una nota descubren un sitio
  | 'roadMap'
  | 'note';

/** Orden en el que se cogen las cosas al registrar un contenedor. */
export const ITEM_KINDS: readonly ItemKind[] = [
  'food',
  'bandage',
  'knife',
  'bat',
  'axe',
  'wood',
  'cloth',
  'curtains',
  'thread',
  'needle',
  'crowbar',
  'machete',
  'painkillers',
  'denim',
  'leather',
  'bucket',
  'waterBucket',
  'waterBottle',
  'hatchet',
  'roadMap',
  'note',
];

/**
 * Lo que guarda un sitio (el almacén, los contenedores, la carga, los montones): montones de lo que
 * es todo igual, contados por tipo, y piezas sueltas con su estado (H5b §1), cada una en un solo
 * sitio.
 */
export type Inventory = Record<ItemKind, number> & { pieces: Piece[] };

export function emptyInventory(): Inventory {
  return {
    food: 0,
    bandage: 0,
    knife: 0,
    bat: 0,
    axe: 0,
    wood: 0,
    cloth: 0,
    curtains: 0,
    thread: 0,
    needle: 0,
    crowbar: 0,
    machete: 0,
    painkillers: 0,
    denim: 0,
    leather: 0,
    bucket: 0,
    waterBucket: 0,
    waterBottle: 0,
    hatchet: 0,
    roadMap: 0,
    note: 0,
    pieces: [],
  };
}

/** ¿Es una bolsa (H5b2)? Las prendas no llevan nada dentro. */
export const isBag = (p: Piece): p is Bag => 'items' in p;

/** Lo que pesa una pieza suelta: una bolsa, vacía más lo de dentro. */
export const pieceKg = (p: Piece): number =>
  isBag(p) ? BAGS[p.kind].kg + weightOf(p.items) : GARMENTS[p.kind].kg;

export function weightOf(inv: Inventory): number {
  const stacks = ITEM_KINDS.reduce((kg, k) => kg + inv[k] * ITEM_WEIGHT_KG[k], 0);
  return inv.pieces.reduce((kg, p) => kg + pieceKg(p), stacks);
}

export function isEmpty(inv: Inventory): boolean {
  return inv.pieces.length === 0 && ITEM_KINDS.every((k) => inv[k] === 0);
}

/** Pasa todo `from` a `to` (también las piezas). */
export function addInto(to: Inventory, from: Inventory): void {
  for (const k of ITEM_KINDS) {
    to[k] += from[k];
    from[k] = 0;
  }
  to.pieces.push(...from.pieces);
  from.pieces = [];
}

/** Suma a `to` los montones de `from`, sin tocar `from` ni las piezas (para el resumen final). */
export function addStacks(to: Inventory, from: Inventory): void {
  for (const k of ITEM_KINDS) to[k] += from[k];
}

/** Una copia que no comparte nada (para el registro: las piezas siguen cambiando). */
export function snapshot(inv: Inventory): Inventory {
  return structuredClone(inv);
}

/**
 * Mueve de `from` a `to` lo que quepa sin pasar de `capacityKg`: primero los montones y luego las
 * piezas, en orden. Devuelve lo cogido (las mismas piezas, no copias).
 */
export function takeUpTo(from: Inventory, to: Inventory, capacityKg: number): Inventory {
  const taken = emptyInventory();
  let load = weightOf(to);
  for (const k of ITEM_KINDS) {
    const each = ITEM_WEIGHT_KG[k];
    const fit = Math.floor((capacityKg - load) / each + 1e-9);
    const n = Math.max(0, Math.min(from[k], fit));
    from[k] -= n;
    to[k] += n;
    taken[k] = n;
    load += n * each;
  }
  const left: Piece[] = [];
  for (const p of from.pieces) {
    if (load + pieceKg(p) <= capacityKg + 1e-9) {
      to.pieces.push(p);
      taken.pieces.push(p);
      load += pieceKg(p);
    } else left.push(p);
  }
  from.pieces = left;
  return taken;
}
