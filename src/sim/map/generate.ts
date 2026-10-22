import { HOUSE_COUNT_MAX, HOUSE_COUNT_MIN, MAP_SIZE, TREE_DENSITY } from '../balance';
import { contains, expand, intersects } from '../geom';
import { findPath } from '../path/astar';
import { nextFloat, nextInt, type RngState } from '../rng';
import { Tile, type Building, type Grid, type Point, type Rect } from '../types';
import { createGrid, getTile, setTile } from './grid';

export interface GeneratedMap {
  grid: Grid;
  base: Building;
  houses: Building[];
  /** Dónde está el pueblo (H4f). */
  town: Rect;
}

type Side = 'top' | 'bottom' | 'left' | 'right';

// Carreteras de 3 casillas que se cruzan en el centro.
const ROAD_MIN = 49;
const ROAD_MAX = 51;
const ROAD_H: Rect = { x: 0, y: ROAD_MIN, w: MAP_SIZE, h: ROAD_MAX - ROAD_MIN + 1 };
const ROAD_V: Rect = { x: ROAD_MIN, y: 0, w: ROAD_MAX - ROAD_MIN + 1, h: MAP_SIZE };

const BASE_RECT: Rect = { x: 35, y: 37, w: 12, h: 10 };
const EDGE_MARGIN = 3;
const BUILDING_GAP = 2;
const HOUSE_ATTEMPTS = 2000;
const MAX_RETRIES = 20;

/** Genera el mapa. Si sale inválido, vuelve a intentarlo con el azar ya avanzado. */
export function generateMap(rng: RngState): GeneratedMap {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const m = tryGenerate(rng);
    if (validate(m)) return m;
  }
  throw new Error('generateMap: no se pudo generar un mapa válido');
}

function tryGenerate(rng: RngState): GeneratedMap {
  const grid = createGrid(MAP_SIZE, MAP_SIZE, Tile.Grass);
  placeRoads(grid);
  const base = { ...placeBuilding(grid, rng, 0, BASE_RECT, 'bottom'), kind: 'base' as const };
  const houses = placeHouses(grid, rng, base);
  placeTrees(grid, rng, [base, ...houses]);
  return { grid, base, houses, town: { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE } };
}

function placeRoads(grid: Grid): void {
  for (let i = 0; i < MAP_SIZE; i++)
    for (let r = ROAD_MIN; r <= ROAD_MAX; r++) {
      setTile(grid, i, r, Tile.Road);
      setTile(grid, r, i, Tile.Road);
    }
}

function placeHouses(grid: Grid, rng: RngState, base: Building): Building[] {
  const target = nextInt(rng, HOUSE_COUNT_MIN, HOUSE_COUNT_MAX);
  const taken: Rect[] = [base.rect];
  const houses: Building[] = [];
  for (let i = 0; i < HOUSE_ATTEMPTS && houses.length < target; i++) {
    const w = nextInt(rng, 8, 12);
    const h = nextInt(rng, 7, 10);
    const rect: Rect = {
      x: nextInt(rng, EDGE_MARGIN, MAP_SIZE - EDGE_MARGIN - w),
      y: nextInt(rng, EDGE_MARGIN, MAP_SIZE - EDGE_MARGIN - h),
      w,
      h,
    };
    const zone = expand(rect, BUILDING_GAP);
    if (intersects(zone, ROAD_H) || intersects(zone, ROAD_V)) continue;
    if (taken.some((t) => intersects(zone, t))) continue;
    taken.push(rect);
    houses.push({
      ...placeBuilding(grid, rng, houses.length + 1, rect, sideFacingRoad(rect)),
      kind: 'house',
    });
  }
  return houses;
}

/** El muro que mira a la carretera más cercana. */
function sideFacingRoad(r: Rect): Side {
  const above = r.y + r.h - 1 < ROAD_MIN; // la casa está encima de la carretera horizontal
  const left = r.x + r.w - 1 < ROAD_MIN;
  const distH = above ? ROAD_MIN - (r.y + r.h - 1) : r.y - ROAD_MAX;
  const distV = left ? ROAD_MIN - (r.x + r.w - 1) : r.x - ROAD_MAX;
  if (distH <= distV) return above ? 'bottom' : 'top';
  return left ? 'right' : 'left';
}

function doorOn(r: Rect, side: Side): Point {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  switch (side) {
    case 'top':
      return { x: cx, y: r.y };
    case 'bottom':
      return { x: cx, y: r.y + r.h - 1 };
    case 'left':
      return { x: r.x, y: cy };
    case 'right':
      return { x: r.x + r.w - 1, y: cy };
  }
}

function placeBuilding(
  grid: Grid,
  rng: RngState,
  id: number,
  r: Rect,
  side: Side,
): Omit<Building, 'kind'> {
  const x1 = r.x + r.w - 1;
  const y1 = r.y + r.h - 1;
  for (let y = r.y; y <= y1; y++)
    for (let x = r.x; x <= x1; x++) {
      const edge = x === r.x || x === x1 || y === r.y || y === y1;
      setTile(grid, x, y, edge ? Tile.Wall : Tile.Floor);
    }

  // Muro interior paralelo al muro de la puerta, por la mitad, con un hueco central.
  // (Paralelo para que nunca tape la entrada.)
  const junctions: Point[] = [];
  if (side === 'top' || side === 'bottom') {
    const wy = r.y + Math.floor(r.h / 2);
    const gap = r.x + Math.floor(r.w / 2);
    for (let x = r.x + 1; x < x1; x++) if (x !== gap) setTile(grid, x, wy, Tile.Wall);
    junctions.push({ x: r.x, y: wy }, { x: x1, y: wy });
  } else {
    const wx = r.x + Math.floor(r.w / 2);
    const gap = r.y + Math.floor(r.h / 2);
    for (let y = r.y + 1; y < y1; y++) if (y !== gap) setTile(grid, wx, y, Tile.Wall);
    junctions.push({ x: wx, y: r.y }, { x: wx, y: y1 });
  }

  const door = doorOn(r, side);
  setTile(grid, door.x, door.y, Tile.Door);
  placeWindows(grid, rng, r, door, junctions);
  return { id, rect: r, door };
}

/** 1–2 ventanas por muro exterior, nunca en esquinas, junto a la puerta ni en uniones de muros. */
function placeWindows(grid: Grid, rng: RngState, r: Rect, door: Point, junctions: Point[]): void {
  const x1 = r.x + r.w - 1;
  const y1 = r.y + r.h - 1;
  const walls: Point[][] = [[], [], [], []];
  for (let x = r.x + 1; x < x1; x++) {
    walls[0]!.push({ x, y: r.y });
    walls[1]!.push({ x, y: y1 });
  }
  for (let y = r.y + 1; y < y1; y++) {
    walls[2]!.push({ x: r.x, y });
    walls[3]!.push({ x: x1, y });
  }
  const blocked = (p: Point) =>
    (Math.abs(p.x - door.x) <= 1 && Math.abs(p.y - door.y) <= 1) ||
    junctions.some((j) => Math.abs(p.x - j.x) <= 1 && Math.abs(p.y - j.y) <= 1);
  for (const wall of walls) {
    const free = wall.filter((p) => !blocked(p));
    const count = Math.min(nextInt(rng, 1, 2), free.length);
    for (let i = 0; i < count; i++) {
      const [p] = free.splice(nextInt(rng, 0, free.length - 1), 1);
      setTile(grid, p!.x, p!.y, Tile.Window);
    }
  }
}

function placeTrees(grid: Grid, rng: RngState, buildings: Building[]): void {
  const zones = buildings.map((b) => expand(b.rect, BUILDING_GAP));
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      if (getTile(grid, x, y) !== Tile.Grass) continue;
      if (nextFloat(rng) >= TREE_DENSITY) continue;
      if (zones.some((z) => contains(z, { x, y }))) continue;
      setTile(grid, x, y, Tile.Tree);
    }
}

function validate(m: GeneratedMap): boolean {
  if (m.houses.length < HOUSE_COUNT_MIN) return false;
  return m.houses.every((h) => findPath(m.grid, m.base.door, h.door) !== null);
}
