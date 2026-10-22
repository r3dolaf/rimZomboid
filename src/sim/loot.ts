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

/** Muebles que admiten de todo (además del suyo, cada cosa puede ir aquí). */
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
      c.items[item] += unit(item);
    }
  }
  fillEmpty(cs);
}

/** Lo que es una unidad de cada cosa en el inventario (el hilo, un carrete de usos). */
const unit = (item: LootItem) => (item === 'thread' ? THREAD_PER_SPOOL : 1);

/** Cuántas unidades de botín tiene un mueble. */
const units = (c: Container) => ITEMS.reduce((n, k) => n + c.items[k] / unit(k), 0);

/**
 * Que ningún mueble se quede vacío si se puede (revisión de H4f): coge una unidad del que más tenga
 * (si tiene más de una), mejor algo que le corresponda. Sin esto, uno de cada cuatro muebles
 * empezaba vacío (armarios de casas sin tela, taquillas de comisaría sin bastantes armas…).
 */
function fillEmpty(cs: Container[]): void {
  for (const empty of cs) {
    if (units(empty) > 0) continue;
    const from = cs.reduce((a, b) => (units(b) > units(a) ? b : a));
    if (units(from) <= 1) return;
    const have = ITEMS.filter((k) => from.items[k] > 0);
    const item =
      have.find((k) => HOME[k].includes(empty.kind) || ANYTHING.includes(empty.kind)) ??
      have.reduce((a, b) => (from.items[b] / unit(b) > from.items[a] / unit(a) ? b : a));
    from.items[item] -= unit(item);
    empty.items[item] += unit(item);
  }
}

function roll(rng: RngState, a: LootAmount | undefined): number {
  if (!a) return 0;
  if (Array.isArray(a)) return nextInt(rng, a[0], a[1]);
  return nextFloat(rng) < a.chance ? 1 : 0;
}

/**
 * Dónde puede ir algo: en su mueble o en una estantería o un mostrador, que tienen un poco de todo
 * (si no, en el supermercado toda la comida iría a las neveras y las estanterías, vacías); si el
 * edificio no tiene ninguno de esos, en cualquiera.
 */
function placesFor(cs: Container[], item: LootItem): Container[] {
  const fit = cs.filter((c) => HOME[item].includes(c.kind) || ANYTHING.includes(c.kind));
  return fit.length > 0 ? fit : cs;
}
