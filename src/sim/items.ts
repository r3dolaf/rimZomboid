import { ITEM_WEIGHT_KG } from './balance';

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
  | 'machete';

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
];

/** Recuento de objetos por tipo. Lo usan el almacén, los contenedores y la carga. */
export type Inventory = Record<ItemKind, number>;

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
  };
}

export function weightOf(inv: Inventory): number {
  return ITEM_KINDS.reduce((kg, k) => kg + inv[k] * ITEM_WEIGHT_KG[k], 0);
}

export function isEmpty(inv: Inventory): boolean {
  return ITEM_KINDS.every((k) => inv[k] === 0);
}

/** Pasa todo `from` a `to`. */
export function addInto(to: Inventory, from: Inventory): void {
  for (const k of ITEM_KINDS) {
    to[k] += from[k];
    from[k] = 0;
  }
}

/** Mueve de `from` a `to` lo que quepa sin pasar de `capacityKg`. Devuelve lo cogido. */
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
  return taken;
}
