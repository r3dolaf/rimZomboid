import {
  AXE_CHANCE,
  BAT_CHANCE,
  CLOTH_WARDROBE_SHARE,
  CROWBAR_CHANCE,
  LOOT_CLOTH_TOTAL,
  MACHETE_CHANCE,
  NEEDLE_TOTAL,
  THREAD_PER_SPOOL,
  THREAD_SPOOLS,
  KNIFE_CHANCE,
  LOOT_BANDAGE_TOTAL,
  LOOT_FOOD_TOTAL,
  LOOT_WOOD_TOTAL,
} from './balance';
import { emptyInventory } from './items';
import { nextFloat, nextInt, type RngState } from './rng';
import type { Building, Container, ContainerKind, Point } from './types';

/** Los muebles del mapa como contenedores (sin registrar ni marcar), con el botín ya repartido. */
export function placeContainers(
  base: Building,
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
  distributeLoot(base, houses, containers, rng);
  return containers;
}

/**
 * Más botín cuanto más lejos de la base: cada casa pesa 1 + 2·d (d de 0 a 1). Una casa sin
 * contenedores pesa 0, para que su parte no se pierda.
 */
export function distributeLoot(
  base: Building,
  houses: Building[],
  containers: Container[],
  rng: RngState,
): void {
  const dist = houses.map((h) =>
    Math.sqrt((h.door.x - base.door.x) ** 2 + (h.door.y - base.door.y) ** 2),
  );
  const maxDist = Math.max(...dist, 1);
  const d = dist.map((x) => x / maxDist);
  const byHouse = houses.map((h) => containers.filter((c) => c.houseId === h.id));
  const weights = d.map((x, i) => (byHouse[i]!.length > 0 ? 1 + 2 * x : 0));
  if (weights.every((x) => x === 0)) return;

  const spread = (total: number, kind: 'food' | 'bandage') => {
    const shares = largestRemainder(total, weights);
    byHouse.forEach((cs, i) => {
      if (cs.length === 0) return;
      for (let k = 0; k < shares[i]!; k++) cs[nextInt(rng, 0, cs.length - 1)]!.items[kind]++;
    });
  };
  spread(LOOT_FOOD_TOTAL, 'food');
  spread(LOOT_BANDAGE_TOTAL, 'bandage');

  byHouse.forEach((cs, i) => {
    for (const c of cs) {
      if (nextFloat(rng) < KNIFE_CHANCE * (0.5 + d[i]!)) c.items.knife++;
      if (nextFloat(rng) < BAT_CHANCE * (0.5 + d[i]!)) c.items.bat++;
    }
  });
}

/** Reparte `total` en enteros proporcionales a `weights` sin perder ninguno. */
function largestRemainder(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left-- <= 0) break;
    out[i]!++;
  }
  return out;
}

/**
 * Madera y hachas (H4a). Se reparte aparte y al final de createWorld para no cambiar partidas
 * anteriores con la misma semilla. La madera, en armarios y estanterías (más lejos, más); el
 * hacha, como el bate, y si no sale ninguna, una en la casa más lejana.
 */
export function distributeWoodAndAxes(
  base: Building,
  houses: Building[],
  containers: Container[],
  rng: RngState,
): void {
  const dist = houses.map((h) =>
    Math.sqrt((h.door.x - base.door.x) ** 2 + (h.door.y - base.door.y) ** 2),
  );
  const maxDist = Math.max(...dist, 1);
  const d = dist.map((x) => x / maxDist);
  const shelves = houses.map((h) =>
    containers.filter((c) => c.houseId === h.id && c.kind !== 'fridge'),
  );
  const weights = d.map((x, i) => (shelves[i]!.length > 0 ? 1 + 2 * x : 0));
  if (weights.some((x) => x > 0)) {
    const shares = largestRemainder(LOOT_WOOD_TOTAL, weights);
    shelves.forEach((cs, i) => {
      for (let k = 0; k < shares[i]!; k++) cs[nextInt(rng, 0, cs.length - 1)]!.items.wood++;
    });
  }
  let axes = 0;
  houses.forEach((h, i) => {
    for (const c of containers)
      if (c.houseId === h.id && nextFloat(rng) < AXE_CHANCE * (0.5 + d[i]!)) {
        c.items.axe++;
        axes++;
      }
  });
  if (axes > 0) return;
  // Siempre al menos una, en la casa más lejana que tenga muebles.
  const order = houses.map((_, i) => i).sort((a, b) => d[b]! - d[a]!);
  for (const i of order) {
    const cs = containers.filter((c) => c.houseId === houses[i]!.id);
    if (cs.length === 0) continue;
    cs[nextInt(rng, 0, cs.length - 1)]!.items.axe++;
    return;
  }
}

/**
 * Tela, carretes de hilo, agujas, palancas y machetes (H4d), aparte y con su propio azar para no
 * cambiar partidas anteriores con la misma semilla. Nada en las neveras; las casas lejanas, más.
 */
export function distributeCraftLoot(
  base: Building,
  houses: Building[],
  containers: Container[],
  rng: RngState,
): void {
  const dist = houses.map((h) =>
    Math.sqrt((h.door.x - base.door.x) ** 2 + (h.door.y - base.door.y) ** 2),
  );
  const maxDist = Math.max(...dist, 1);
  const d = dist.map((x) => x / maxDist);
  const near = (c: Container) => d[houses.findIndex((h) => h.id === c.houseId)] ?? 0;
  const of = (kind: ContainerKind) => containers.filter((c) => c.kind === kind);
  const notFridge = containers.filter((c) => c.kind !== 'fridge');
  /** Reparte `n` unidades (de `step` en `step`) entre `cs`, más en las casas lejanas. */
  const spread = (cs: Container[], n: number, add: (c: Container) => void) => {
    if (cs.length === 0) return;
    const shares = largestRemainder(
      n,
      cs.map((c) => 1 + 2 * near(c)),
    );
    cs.forEach((c, i) => {
      for (let k = 0; k < shares[i]!; k++) add(c);
    });
  };
  // La tela, sobre todo en armarios (si no hay, todo en estanterías, y al revés).
  const wardrobes = of('wardrobe');
  const shelves = of('shelf');
  const inWardrobes =
    shelves.length === 0
      ? LOOT_CLOTH_TOTAL
      : wardrobes.length === 0
        ? 0
        : Math.round(LOOT_CLOTH_TOTAL * CLOTH_WARDROBE_SHARE);
  spread(wardrobes, inWardrobes, (c) => c.items.cloth++);
  spread(shelves, LOOT_CLOTH_TOTAL - inWardrobes, (c) => c.items.cloth++);
  // Carretes y agujas, uno a uno en muebles al azar (más en los lejanos).
  const weights = notFridge.map((c) => 1 + 2 * near(c));
  const total = weights.reduce((a, b) => a + b, 0);
  const pickOne = (): Container | null => {
    if (notFridge.length === 0) return null;
    let r = nextFloat(rng) * total;
    for (let i = 0; i < notFridge.length; i++) {
      r -= weights[i]!;
      if (r < 0) return notFridge[i]!;
    }
    return notFridge[notFridge.length - 1]!;
  };
  for (let k = 0; k < THREAD_SPOOLS; k++) {
    const c = pickOne();
    if (c) c.items.thread += THREAD_PER_SPOOL;
  }
  for (let k = 0; k < NEEDLE_TOTAL; k++) {
    const c = pickOne();
    if (c) c.items.needle++;
  }
  for (const c of notFridge) {
    if (nextFloat(rng) < CROWBAR_CHANCE * (0.5 + near(c))) c.items.crowbar++;
    if (nextFloat(rng) < MACHETE_CHANCE * (0.5 + near(c))) c.items.machete++;
  }
}
