// Botín (spec H4f §4): cada tipo de edificio tiene el suyo, y cada cosa va a su mueble.
import { LOOT, THREAD_PER_SPOOL, type LootAmount, type LootItem } from './balance';
import { emptyInventory } from './items';
import { nextFloat, nextInt, type RngState } from './rng';
import type { Building, Container, ContainerKind, LootKind, Point } from './types';

/** Lo que se reparte, siempre en este orden (para que el azar dé lo mismo con la misma semilla). */
const ITEMS: readonly LootItem[] = [
  'food',
  'bandage',
  'wood',
  'cloth',
  'thread',
  'needle',
  'knife',
  'bat',
  'axe',
  'crowbar',
  'machete',
];

/** El mueble de cada cosa (spec H4f §4). */
const HOME: Record<LootItem, readonly ContainerKind[]> = {
  food: ['fridge'],
  bandage: ['medicine'],
  cloth: ['wardrobe'],
  thread: ['wardrobe'],
  needle: ['wardrobe'],
  knife: ['locker'],
  bat: ['locker'],
  machete: ['locker'],
  axe: ['crate'],
  crowbar: ['crate'],
  wood: ['crate'],
};

/** Si el edificio no tiene el mueble de algo, va aquí (y si tampoco, a cualquiera). */
const ANYTHING: readonly ContainerKind[] = ['shelf', 'counter'];

/** Los muebles del mapa como contenedores (sin registrar ni marcar), con su botín. */
export function placeContainers(
  houses: Building[],
  furniture: { houseId: number; pos: Point; kind: ContainerKind }[],
  rng: RngState,
): Container[] {
  const containers: Container[] = furniture.map((f, i) => ({
    id: i + 1,
    houseId: f.houseId,
    pos: f.pos,
    kind: f.kind,
    items: emptyInventory(),
    searched: false,
    designated: false,
    reservedBy: null,
  }));
  for (const h of houses)
    if (h.kind !== 'base')
      fillBuilding(
        h.kind,
        containers.filter((c) => c.houseId === h.id),
        rng,
      );
  return containers;
}

/**
 * Sortea el botín de un edificio de tipo `kind` y lo reparte entre sus muebles: cada cosa, en uno
 * de los suyos al azar. Primero se sortean las cantidades y después se reparten, así lo que hay
 * no depende de qué muebles tenga.
 */
export function fillBuilding(kind: LootKind, cs: Container[], rng: RngState): void {
  if (cs.length === 0) return;
  const spec = LOOT[kind];
  const amounts = ITEMS.map((item) => [item, roll(rng, spec[item])] as const);
  for (const [item, n] of amounts) {
    const pool = placesFor(cs, item);
    for (let k = 0; k < n; k++) {
      const c = pool[nextInt(rng, 0, pool.length - 1)]!;
      c.items[item] += item === 'thread' ? THREAD_PER_SPOOL : 1;
    }
  }
}

function roll(rng: RngState, a: LootAmount | undefined): number {
  if (!a) return 0;
  if (Array.isArray(a)) return nextInt(rng, a[0], a[1]);
  return nextFloat(rng) < a.chance ? 1 : 0;
}

function placesFor(cs: Container[], item: LootItem): Container[] {
  const home = cs.filter((c) => HOME[item].includes(c.kind));
  if (home.length > 0) return home;
  const any = cs.filter((c) => ANYTHING.includes(c.kind));
  return any.length > 0 ? any : cs;
}
