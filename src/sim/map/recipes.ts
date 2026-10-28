// Recetas de edificio (spec H4f §3): muros, tabiques, puerta, ventanas y muebles de cada tipo.
// Se trabaja en coordenadas "locales": d, la profundidad desde el muro de la puerta (0), y l, de
// lado a lado; así una receta vale para cualquier lado al que mire la puerta.
import { BUILDINGS } from '../balance';
import { nextInt, type RngState } from '../rng';
import {
  Tile,
  type Building,
  type ContainerKind,
  type Grid,
  type LootKind,
  type Point,
} from '../types';
import { getTile, setTile } from './grid';
import type { Lot, Side } from './layout';

/** Un mueble de saqueo por colocar. */
export interface Furnishing {
  pos: Point;
  kind: ContainerKind;
}

/** Medidas en coordenadas locales y cómo pasar de ellas al mapa. */
export interface Frame {
  depth: number;
  width: number;
  at(d: number, l: number): Point;
  local(p: Point): { d: number; l: number };
}

export function frameOf(rect: Building['rect'], side: Side): Frame {
  const { x, y, w, h } = rect;
  const x1 = x + w - 1;
  const y1 = y + h - 1;
  switch (side) {
    case 'bottom':
      return {
        depth: h,
        width: w,
        at: (d, l) => ({ x: x + l, y: y1 - d }),
        local: (p) => ({ d: y1 - p.y, l: p.x - x }),
      };
    case 'top':
      return {
        depth: h,
        width: w,
        at: (d, l) => ({ x: x + l, y: y + d }),
        local: (p) => ({ d: p.y - y, l: p.x - x }),
      };
    case 'left':
      return {
        depth: w,
        width: h,
        at: (d, l) => ({ x: x + d, y: y + l }),
        local: (p) => ({ d: p.x - x, l: p.y - y }),
      };
    case 'right':
      return {
        depth: w,
        width: h,
        at: (d, l) => ({ x: x1 - d, y: y + l }),
        local: (p) => ({ d: x1 - p.x, l: p.y - y }),
      };
  }
}

/** Hacia dónde mira la puerta (el muro en que está). */
export function doorSide(b: Building): Side {
  const { x, y, h } = b.rect;
  if (b.door.y === y + h - 1) return 'bottom';
  if (b.door.y === y) return 'top';
  if (b.door.x === x) return 'left';
  return 'right';
}

/** Tabiques paralelos al muro de la puerta: a qué profundidad (con un hueco en medio). */
function partitions(kind: Building['kind'], depth: number): number[] {
  switch (kind) {
    case 'base':
    case 'house':
    case 'farm':
      return [Math.floor(depth / 2)];
    case 'police':
      return [Math.floor(depth / 3), Math.floor((2 * depth) / 3)];
    default:
      return [];
  }
}

/** Ventanas de cada muro: el de delante y los demás ('alt': una sí y otra no). */
const WINDOWS: Record<
  Building['kind'],
  { front: [number, number] | 'alt'; other: [number, number] }
> = {
  base: { front: [1, 2], other: [1, 2] },
  house: { front: [1, 2], other: [1, 2] },
  supermarket: { front: 'alt', other: [0, 1] },
  pharmacy: { front: [1, 2], other: [1, 2] },
  hardware: { front: [1, 1], other: [1, 1] },
  police: { front: [1, 1], other: [1, 1] },
  clothes: { front: [2, 3], other: [1, 1] },
  gas: { front: [2, 2], other: [0, 0] },
  farm: { front: [1, 2], other: [1, 2] },
  warehouse: { front: [0, 1], other: [0, 1] },
};

/** Levanta el edificio del lote: muros, suelo, tabiques, puerta y ventanas. */
export function buildBuilding(grid: Grid, rng: RngState, id: number, lot: Lot): Building {
  const f = frameOf(lot.rect, lot.side);
  for (let d = 0; d < f.depth; d++)
    for (let l = 0; l < f.width; l++) {
      const edge = d === 0 || l === 0 || d === f.depth - 1 || l === f.width - 1;
      const p = f.at(d, l);
      setTile(grid, p.x, p.y, edge ? Tile.Wall : Tile.Floor);
    }
  const mid = Math.floor(f.width / 2);
  const junctions: Point[] = [];
  for (const wd of partitions(lot.kind, f.depth)) {
    for (let l = 1; l < f.width - 1; l++)
      if (l !== mid) {
        const p = f.at(wd, l);
        setTile(grid, p.x, p.y, Tile.Wall);
      }
    junctions.push(f.at(wd, 0), f.at(wd, f.width - 1));
  }
  const door = f.at(0, mid);
  setTile(grid, door.x, door.y, Tile.Door);
  const b: Building = { id, kind: lot.kind, rect: lot.rect, door };
  placeWindows(grid, rng, b, f, junctions);
  return b;
}

/** Ventanas: nunca en esquinas, junto a la puerta ni en uniones de muros. */
function placeWindows(grid: Grid, rng: RngState, b: Building, f: Frame, junctions: Point[]): void {
  const spec = WINDOWS[b.kind];
  const walls: Point[][] = [[], [], [], []]; // delante, fondo, un lado, el otro
  for (let l = 1; l < f.width - 1; l++) {
    walls[0]!.push(f.at(0, l));
    walls[1]!.push(f.at(f.depth - 1, l));
  }
  for (let d = 1; d < f.depth - 1; d++) {
    walls[2]!.push(f.at(d, 0));
    walls[3]!.push(f.at(d, f.width - 1));
  }
  const near = (p: Point, q: Point) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= 1;
  const blocked = (p: Point) => near(p, b.door) || junctions.some((j) => near(p, j));
  walls.forEach((wall, i) => {
    const free = wall.filter((p) => !blocked(p));
    const rule = i === 0 ? spec.front : spec.other;
    if (rule === 'alt') {
      free.forEach((p, k) => k % 2 === 0 && setTile(grid, p.x, p.y, Tile.Window));
      return;
    }
    const count = Math.min(nextInt(rng, rule[0], rule[1]), free.length);
    for (let k = 0; k < count; k++) {
      const [p] = free.splice(nextInt(rng, 0, free.length - 1), 1);
      setTile(grid, p!.x, p!.y, Tile.Window);
    }
  });
}

/** Casillas donde puede ir un mueble, por zonas del edificio. */
interface Spots {
  /** Suelo pegado a un muro (no en los pasos de los tabiques ni junto a la puerta). */
  wall: Point[];
  /** Junto al muro del fondo. */
  back: Point[];
  /** Junto a la puerta (para el mostrador). */
  counter: Point[];
  /** En filas paralelas a la fachada, con pasillos (estanterías, percheros, cajas). */
  rows: Point[];
}

function spotsOf(grid: Grid, b: Building): Spots {
  const f = frameOf(b.rect, doorSide(b));
  const isWall = (p: Point) => getTile(grid, p.x, p.y) === Tile.Wall;
  const mid = Math.floor(f.width / 2);
  const out: Spots = { wall: [], back: [], counter: [], rows: [] };
  for (let d = 1; d < f.depth - 1; d++)
    for (let l = 1; l < f.width - 1; l++) {
      const p = f.at(d, l);
      if (getTile(grid, p.x, p.y) !== Tile.Floor) continue;
      if (d <= 1 && Math.abs(l - mid) <= 1) continue; // la entrada, libre
      const n = [
        { x: p.x - 1, y: p.y },
        { x: p.x + 1, y: p.y },
        { x: p.x, y: p.y - 1 },
        { x: p.x, y: p.y + 1 },
      ];
      const gapTile = (isWall(n[0]!) && isWall(n[1]!)) || (isWall(n[2]!) && isWall(n[3]!));
      if (gapTile) continue;
      const byWall = n.some(isWall);
      if (byWall) out.wall.push(p);
      if (d === f.depth - 2) out.back.push(p);
      if (d === 1 && Math.abs(l - mid) >= 2 && Math.abs(l - mid) <= 3) out.counter.push(p);
      if (!byWall && d >= 3 && d <= f.depth - 3 && l >= 2 && l <= f.width - 3 && d % 3 === 0)
        out.rows.push(p);
    }
  // Las filas se llenan a la vez y desde el centro: así, con pocos muebles, salen varios pasillos
  // iguales en vez de una fila larga.
  const byRow = new Map<number, Point[]>();
  for (const p of out.rows) {
    const d = f.local(p).d;
    byRow.set(d, [...(byRow.get(d) ?? []), p]);
  }
  const rows = [...byRow.values()].map((r) =>
    r.sort((a, b) => Math.abs(f.local(a).l - mid) - Math.abs(f.local(b).l - mid)),
  );
  out.rows = [];
  for (let k = 0; rows.some((r) => k < r.length); k++)
    for (const r of rows) if (k < r.length) out.rows.push(r[k]!);
  return out;
}

/**
 * Saca `n` casillas de `from` (sin repetir y sin las ya usadas): al azar o, en las filas, seguidas
 * (para que las estanterías, percheros y cajas formen filas con sus pasillos).
 */
function take(
  rng: RngState,
  from: Point[],
  n: number,
  used: Set<string>,
  inOrder = false,
): Point[] {
  const pool = from.filter((p) => !used.has(`${p.x},${p.y}`));
  const out: Point[] = [];
  while (out.length < n && pool.length > 0) {
    const [p] = pool.splice(inOrder ? 0 : nextInt(rng, 0, pool.length - 1), 1);
    used.add(`${p!.x},${p!.y}`);
    out.push(p!);
  }
  return out;
}

/** Las casillas de suelo junto a una pared (para los fregaderos y las cisternas, H5b). */
export function wallSpots(grid: Grid, b: Building): Point[] {
  return spotsOf(grid, b).wall;
}

/** Los muebles de saqueo del edificio, según su tipo (la base no tiene). */
export function furnish(grid: Grid, rng: RngState, b: Building): Furnishing[] {
  if (b.kind === 'base') return [];
  const kind: LootKind = b.kind;
  const [lo, hi] = BUILDINGS[kind].containers;
  const total = nextInt(rng, lo, hi);
  const s = spotsOf(grid, b);
  const used = new Set<string>();
  const out: Furnishing[] = [];
  const put = (from: Point[], n: number, k: ContainerKind | readonly ContainerKind[]) => {
    const inOrder = from === s.rows;
    for (const pos of take(rng, from, Math.min(n, total - out.length), used, inOrder))
      out.push({ pos, kind: typeof k === 'string' ? k : k[nextInt(rng, 0, k.length - 1)]! });
  };
  const fill = (from: Point[], k: ContainerKind | readonly ContainerKind[]) =>
    put(from, total - out.length, k);
  switch (kind) {
    case 'house':
      fill(s.wall, ['fridge', 'wardrobe', 'shelf']);
      break;
    case 'supermarket':
      put(s.counter, 1, 'counter');
      put(s.back, nextInt(rng, 2, 4), 'fridge');
      fill(s.rows, 'shelf');
      fill(s.wall, 'shelf');
      break;
    case 'pharmacy':
      put(s.counter, 1, 'counter');
      put(s.wall, total - out.length - 1, 'medicine');
      fill(s.wall, ['medicine', 'shelf']);
      break;
    case 'hardware':
      put(s.counter, 1, 'counter');
      put(s.rows, Math.ceil((total - out.length) / 2), 'crate');
      fill(s.wall, ['shelf', 'crate']);
      break;
    case 'police':
      put(s.wall, Math.ceil(total / 2), 'locker');
      put(s.wall, total - out.length - 1, ['crate', 'locker']);
      fill(s.wall, 'shelf');
      break;
    case 'clothes':
      put(s.counter, 1, 'counter');
      fill(s.rows, 'wardrobe');
      fill(s.wall, 'wardrobe');
      break;
    case 'gas':
      put(s.counter, 1, 'counter');
      put(s.back, 1, 'fridge');
      fill(s.wall, 'shelf');
      break;
    case 'farm': {
      // Vivienda delante del tabique; granero detrás.
      const f = frameOf(b.rect, doorSide(b));
      const half = Math.floor(f.depth / 2);
      const front = s.wall.filter((p) => f.local(p).d < half);
      const back = s.wall.filter((p) => f.local(p).d > half);
      put(front, 1, 'fridge');
      put(front, 2, ['wardrobe', 'shelf']);
      fill(back, 'crate');
      fill(front, 'shelf');
      break;
    }
    case 'warehouse':
      fill(s.rows, 'crate');
      fill(s.wall, 'crate');
      break;
  }
  return out;
}
