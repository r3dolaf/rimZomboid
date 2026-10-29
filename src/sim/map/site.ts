// El mapa de un sitio (spec H5c1 §2): una carretera que entra por su lado, los edificios de su
// tipo (con las recetas y los muebles del pueblo, H4f), árboles y el campamento junto a la entrada.
import { BUILDINGS, SITE_SIZE, VILLAGE_SIZE } from '../balance';
import { intersects } from '../geom';
import { findPath } from '../path/astar';
import { nextFloat, nextInt, pick, type RngState } from '../rng';
import {
  Tile,
  type Building,
  type ContainerKind,
  type Grid,
  type LootKind,
  type MapSide,
  type Point,
  type Rect,
  type SiteKind,
  type SiteSpecial,
} from '../types';
import { createGrid, getTile, setTile } from './grid';
import type { Lot, Side } from './layout';
import { buildBuilding, furnish } from './recipes';

export interface GeneratedSite {
  grid: Grid;
  /** El campamento, que hace de base del mapa (su almacén). */
  base: Building;
  houses: Building[];
  furniture: { houseId: number; pos: Point; kind: ContainerKind }[];
  /** Casillas de la carretera en el borde por donde se entra y se sale. */
  entry: Point[];
  /** Las 3×3 casillas del campamento (suelo). */
  camp: Point[];
  /** Donde va el plano de la hoguera. */
  campfire: Point;
}

const MAX_RETRIES = 20;
/** Separación entre edificios. */
const GAP = 2;
/** Los edificios, a partir de esta distancia de la entrada (el campamento va antes). */
const FIRST_LOT = 12;
const TREE_CHANCE = 0.04;

/** Los edificios de cada sitio (el peligroso y el alijo, los suyos). */
function buildingsFor(kind: SiteKind, special: SiteSpecial | null, rng: RngState): LootKind[] {
  if (special === 'dangerous') return [nextFloat(rng) < 0.5 ? 'police' : 'supermarket'];
  if (special === 'stash') return ['house'];
  switch (kind) {
    case 'house':
      return ['house'];
    case 'farm':
      return ['farm', 'house'];
    case 'gas':
      return ['gas'];
    case 'warehouse':
      return ['warehouse'];
    case 'village': {
      const houses = Array.from({ length: nextInt(rng, 4, 6) }, () => 'house' as const);
      return [...houses, pick(rng, ['supermarket', 'pharmacy', 'clothes'] as const)];
    }
  }
}

/**
 * Coordenadas del sitio: `u` desde la entrada a lo largo de la carretera, `v` a lo ancho (la
 * carretera ocupa v −1…1). Así todo se dibuja igual para los cuatro lados.
 */
function toXY(side: MapSide, n: number, u: number, v: number): Point {
  const c = Math.floor(n / 2);
  if (side === 0) return { x: c + v, y: u };
  if (side === 1) return { x: c + v, y: n - 1 - u };
  if (side === 2) return { x: u, y: c + v };
  return { x: n - 1 - u, y: c + v };
}

function boxToRect(side: MapSide, n: number, u0: number, v0: number, du: number, dv: number): Rect {
  const a = toXY(side, n, u0, v0);
  const b = toXY(side, n, u0 + du - 1, v0 + dv - 1);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

/** Hacia dónde mira la fachada: a la carretera. */
function facing(side: MapSide, towardNegV: boolean): Side {
  if (side < 2) return towardNegV ? 'left' : 'right';
  return towardNegV ? 'top' : 'bottom';
}

const expand = (r: Rect, d: number): Rect => ({
  x: r.x - d,
  y: r.y - d,
  w: r.w + 2 * d,
  h: r.h + 2 * d,
});

/** Un sitio de su tipo; si sale mal (algo no se alcanza), lo vuelve a intentar. */
export function generateSite(
  kind: SiteKind,
  special: SiteSpecial | null,
  side: MapSide,
  rng: RngState,
): GeneratedSite {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const s = tryGenerate(kind, special, side, rng);
    if (s && s.houses.every((h) => findPath(s.grid, s.entry[1]!, h.door) !== null)) return s;
  }
  throw new Error('generateSite: no se pudo generar un sitio válido');
}

function tryGenerate(
  kind: SiteKind,
  special: SiteSpecial | null,
  side: MapSide,
  rng: RngState,
): GeneratedSite | null {
  const n = kind === 'village' ? VILLAGE_SIZE : SITE_SIZE;
  const c = Math.floor(n / 2);
  const grid = createGrid(n, n, Tile.Grass);
  const at = (u: number, v: number) => toXY(side, n, u, v);
  // La carretera, de la entrada al otro lado.
  for (let u = 0; u < n; u++)
    for (let v = -1; v <= 1; v++) {
      const p = at(u, v);
      setTile(grid, p.x, p.y, Tile.Road);
    }
  const entry = [-1, 0, 1].map((v) => at(0, v));
  // El campamento, a la izquierda de la carretera, a 3 casillas del borde.
  const camp: Point[] = [];
  for (let u = 3; u <= 5; u++)
    for (let v = -6; v <= -4; v++) {
      const p = at(u, v);
      setTile(grid, p.x, p.y, Tile.Floor);
      camp.push(p);
    }
  const campRect = boxToRect(side, n, 3, -6, 3, 3);
  const campfire = at(4, -8);
  // Los edificios, a los dos lados de la carretera, mirándola.
  const lots: Lot[] = [];
  for (const b of buildingsFor(kind, special, rng)) {
    const spec = BUILDINGS[b];
    let lot: Lot | null = null;
    for (let k = 0; k < 60 && !lot; k++) {
      const front = nextInt(rng, spec.w[0], spec.w[1]);
      const depth = nextInt(rng, spec.h[0], spec.h[1]);
      const right = nextFloat(rng) < 0.5;
      const v0 = right ? 3 : -2 - depth;
      const maxU = n - front - 3;
      if (maxU < FIRST_LOT || v0 < -c || v0 + depth - 1 > n - 1 - c) continue;
      const u0 = nextInt(rng, FIRST_LOT, maxU);
      const rect = boxToRect(side, n, u0, v0, front, depth);
      if (lots.some((l) => intersects(expand(rect, GAP), l.rect))) continue;
      lot = { kind: b, rect, side: facing(side, right) };
    }
    if (!lot) return null;
    lots.push(lot);
  }
  const houses = lots.map((lot, i) => buildBuilding(grid, rng, i + 1, lot));
  const furniture = houses.flatMap((h) =>
    furnish(grid, rng, h).map((f) => ({ houseId: h.id, ...f })),
  );
  // Árboles, lejos de la carretera, los edificios y el campamento.
  const clear = [...lots.map((l) => expand(l.rect, 2)), expand(campRect, 3)];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (getTile(grid, x, y) !== Tile.Grass) continue;
      const v = side < 2 ? x - c : y - c;
      if (Math.abs(v) <= 3 || clear.some((r) => intersects(r, { x, y, w: 1, h: 1 }))) continue;
      if (nextFloat(rng) < TREE_CHANCE) setTile(grid, x, y, Tile.Tree);
    }
  // El campamento hace de base del mapa (su centro, de «puerta»).
  const base: Building = { id: 0, kind: 'base', rect: campRect, door: camp[4]! };
  return { grid, base, houses, furniture, entry, camp, campfire };
}
