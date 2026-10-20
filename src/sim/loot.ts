import {
  BAT_CHANCE,
  CONTAINERS_MAX,
  CONTAINERS_MIN,
  KNIFE_CHANCE,
  LOOT_BANDAGE_TOTAL,
  LOOT_FOOD_TOTAL,
} from './balance';
import { emptyInventory } from './items';
import { getTile } from './map/grid';
import { nextFloat, nextInt, pick, type RngState } from './rng';
import {
  Tile,
  type Building,
  type Container,
  type ContainerKind,
  type Grid,
  type Point,
} from './types';

const KINDS: readonly ContainerKind[] = ['fridge', 'wardrobe', 'shelf'];

/** Contenedores de todas las casas, con el botín ya repartido. */
export function placeContainers(
  grid: Grid,
  base: Building,
  houses: Building[],
  rng: RngState,
): Container[] {
  const containers: Container[] = [];
  for (const h of houses) {
    const spots = candidateSpots(grid, h);
    const n = Math.min(spots.length, nextInt(rng, CONTAINERS_MIN, CONTAINERS_MAX));
    for (let i = 0; i < n; i++) {
      const [pos] = spots.splice(nextInt(rng, 0, spots.length - 1), 1);
      containers.push({
        id: containers.length + 1,
        houseId: h.id,
        pos: pos!,
        kind: pick(rng, KINDS),
        items: emptyInventory(),
        searched: false,
        designated: false,
        reservedBy: null,
      });
    }
  }
  distributeLoot(base, houses, containers, rng);
  return containers;
}

/** Suelo de la casa junto a una pared, lejos de la puerta y fuera de los pasos entre muros. */
function candidateSpots(grid: Grid, h: Building): Point[] {
  const out: Point[] = [];
  const wall = (x: number, y: number) => getTile(grid, x, y) === Tile.Wall;
  for (let y = h.rect.y + 1; y < h.rect.y + h.rect.h - 1; y++)
    for (let x = h.rect.x + 1; x < h.rect.x + h.rect.w - 1; x++) {
      if (getTile(grid, x, y) !== Tile.Floor) continue;
      if (Math.max(Math.abs(x - h.door.x), Math.abs(y - h.door.y)) <= 1) continue;
      const isGap = (wall(x - 1, y) && wall(x + 1, y)) || (wall(x, y - 1) && wall(x, y + 1));
      if (isGap) continue;
      if (wall(x - 1, y) || wall(x + 1, y) || wall(x, y - 1) || wall(x, y + 1)) out.push({ x, y });
    }
  return out;
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
