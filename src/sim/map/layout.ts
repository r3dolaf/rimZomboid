// Trazado del mapa (spec H4f §2): carretera principal, pueblo con manzanas y calles, caminos y
// dónde va cada edificio (la base incluida), y los árboles. Se piensa con la carretera en
// horizontal (u a lo largo, v a lo ancho) y, si sale vertical, se gira al final.
import { BASE_PLACE, BUILDINGS, MAP_SIZE, TREE_DENSITY_FAR, TREE_DENSITY_NEAR } from '../balance';
import { contains, expand, intersects } from '../geom';
import { nextFloat, nextInt, type RngState } from '../rng';
import { Tile, type BuildingKind, type Grid, type Rect } from '../types';
import { createGrid, getTile, setTile } from './grid';

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** Un edificio por hacer: de qué tipo, dónde y hacia dónde mira su puerta. */
export interface Lot {
  kind: BuildingKind;
  rect: Rect;
  side: Side;
}

export interface MapPlan {
  grid: Grid;
  town: Rect;
  lots: Lot[];
}

const EDGE = 3; // ningún edificio a menos de esto del borde
const STREET = 2;
const MAIN = 3; // la carretera principal
const COUNTRY = 2; // los caminos
const BLOCK: [number, number] = [16, 20];
const GAP = 2; // casillas libres entre edificios
/** La base: fachada × fondo (la de siempre, 12×10). */
export const BASE_SIZE: [number, number] = [12, 10];
const OUTSKIRTS: [number, number] = [4, 20]; // a cuánto del pueblo están las afueras
const COUNTRY_MIN = 31; // el campo, a más de 30 del pueblo
const OUTSIDE_MIN = 4; // lo de fuera, al menos a esto del pueblo
const YARD: [number, number] = [2, 6]; // fuera del pueblo, entre la carretera y la fachada
const APRON = 4; // la explanada de la gasolinera
const TREES_NEAR = 4; // a esta distancia de una carretera o menos, pocos árboles
const TREES_FAR = 20; // a esta o más, bosque
const SHOPS: readonly BuildingKind[] = ['supermarket', 'pharmacy', 'hardware', 'police', 'clothes'];
const ATTEMPTS = 300;
const MAX_TRIES = 50;

/** Carretera o calle en el marco canónico, y si va a lo largo (horizontal) o a lo ancho. */
interface Band {
  rect: Rect;
  along: boolean;
  main?: boolean;
}

/** Casillas libres entre `r` y `t` (0 si se tocan o se solapan). */
export function gapBetween(r: Rect, t: Rect): number {
  const dx = Math.max(t.x - (r.x + r.w), r.x - (t.x + t.w), 0);
  const dy = Math.max(t.y - (r.y + r.h), r.y - (t.y + t.h), 0);
  return Math.max(dx, dy);
}

/** Traza el mapa. Si un intento no cabe, vuelve a probar con el azar ya avanzado. */
export function planMap(rng: RngState): MapPlan {
  // Dónde va la base se sortea una vez: si se sorteara en cada intento, los sitios que cuesta más
  // encajar (afueras y campo) saldrían menos de lo que toca.
  const roll = nextFloat(rng);
  const where: BaseWhere =
    roll < BASE_PLACE.town
      ? 'town'
      : roll < BASE_PLACE.town + BASE_PLACE.outskirts
        ? 'outskirts'
        : 'country';
  for (let i = 0; i < MAX_TRIES; i++) {
    const p = tryPlan(rng, where);
    if (p) return p;
  }
  throw new Error('planMap: no se pudo trazar el mapa');
}

type BaseWhere = 'town' | 'outskirts' | 'country';

function tryPlan(rng: RngState, baseWhere: BaseWhere): MapPlan | null {
  const horizontal = nextFloat(rng) < 0.5;
  const rv = nextInt(rng, 40, MAP_SIZE - 40 - MAIN);
  const main: Band = { rect: { x: 0, y: rv, w: MAP_SIZE, h: MAIN }, along: true, main: true };
  const t = planTown(rng, rv);
  if (!t) return null;
  const bands: Band[] = [main, ...t.streets];
  const lots: Lot[] = [];
  const aprons: Rect[] = [];

  // Las tiendas, cada una en una manzana distinta; luego, quizá, la base.
  const blocks = shuffle(rng, t.blocks);
  let b = 0;
  for (const kind of SHOPS) {
    const lot = inBlock(rng, blocks[b++]!, kind, lots);
    if (!lot) return null;
    lots.push(lot);
  }
  if (baseWhere === 'town') {
    const lot = inBlock(rng, blocks[b]!, 'base', lots);
    if (!lot) return null;
    lots.push(lot);
  }
  // Casas hasta llenar cada manzana con 1–4 edificios.
  for (const block of t.blocks) {
    const want = nextInt(rng, 2, 4);
    for (let k = 0; k < 80 && lots.filter((l) => intersects(l.rect, block)).length < want; k++) {
      const lot = inBlock(rng, block, 'house', lots);
      if (lot) lots.push(lot);
    }
  }

  // Caminos: 1–2, a lo ancho, desde la carretera hasta el borde, lejos del pueblo y entre sí.
  const roads = nextInt(rng, 1, 2);
  for (let k = 0, made = 0; k < ATTEMPTS && made < roads; k++) {
    const u = nextInt(rng, EDGE + 10, MAP_SIZE - EDGE - 10 - COUNTRY);
    const up = nextFloat(rng) < 0.5;
    const rect = up
      ? { x: u, y: 0, w: COUNTRY, h: rv }
      : { x: u, y: rv + MAIN, w: COUNTRY, h: MAP_SIZE - rv - MAIN };
    if (gapBetween(rect, t.town) < 10) continue;
    if (bands.some((o) => !o.along && gapBetween(rect, o.rect) < 6)) continue;
    bands.push({ rect, along: false });
    made++;
  }
  const outside = bands.filter((o) => o.main || !t.streets.includes(o));

  // Fuera del pueblo: la base (si toca), gasolinera, nave, dos granjas y 3–5 casas sueltas.
  const townGap = (r: Rect) => gapBetween(r, t.town);
  const place = (kind: BuildingKind, ok: (r: Rect) => boolean, onlyMain = false) => {
    const choices = onlyMain ? [main] : outside;
    for (let k = 0; k < ATTEMPTS; k++) {
      const lot = alongRoad(rng, choices[nextInt(rng, 0, choices.length - 1)]!, kind);
      if (!lot || !ok(lot.rect)) continue;
      if (!clear(lot.rect, lots, aprons, bands)) continue;
      return lot;
    }
    return null;
  };
  if (baseWhere !== 'town') {
    const [lo, hi] = baseWhere === 'outskirts' ? OUTSKIRTS : [COUNTRY_MIN, MAP_SIZE];
    const lot = place(
      'base',
      (r) => townGap(r) >= lo && townGap(r) <= hi && !intersects(r, t.town),
    );
    if (!lot) return null;
    lots.push(lot);
  }
  const away = (r: Rect) => townGap(r) >= OUTSIDE_MIN && !intersects(r, t.town);
  const gas = place('gas', away, true);
  if (!gas) return null;
  lots.push(gas);
  aprons.push(apronOf(gas));
  for (const kind of ['warehouse', 'farm', 'farm'] as const) {
    const lot = place(kind, away);
    if (!lot) return null;
    lots.push(lot);
  }
  const loose = nextInt(rng, 3, 5);
  for (let k = 0; k < loose; k++) {
    const lot = place('house', away);
    if (lot) lots.push(lot);
    else if (k < 3) return null;
  }

  // Se gira si la carretera sale vertical, y se pinta.
  const turn = horizontal ? (r: Rect) => r : transpose;
  const grid = createGrid(MAP_SIZE, MAP_SIZE, Tile.Grass);
  for (const band of bands) paint(grid, turn(band.rect));
  for (const a of aprons) paint(grid, turn(a));
  const final = lots.map((l) => ({
    kind: l.kind,
    rect: turn(l.rect),
    side: horizontal ? l.side : turnSide(l.side),
  }));
  placeTrees(grid, rng, final, turn(t.town));
  return { grid, town: turn(t.town), lots: final };
}

/** El pueblo: manzanas entre calles, y una de las calles a lo largo es la carretera principal. */
function planTown(
  rng: RngState,
  rv: number,
): { town: Rect; blocks: Rect[]; streets: Band[] } | null {
  const shapes: [number, number][] = [
    [3, 3],
    [3, 4],
    [4, 3],
  ];
  const [nu, nv] = shapes[nextInt(rng, 0, shapes.length - 1)]!;
  const bu = Array.from({ length: nu }, () => nextInt(rng, BLOCK[0], BLOCK[1]));
  const bv = Array.from({ length: nv }, () => nextInt(rng, BLOCK[0], BLOCK[1]));
  // La calle a lo largo número k (1..nv-1) es la carretera principal.
  const k = nextInt(rng, 1, nv - 1);
  const lineW = (j: number) => (j === k ? MAIN : STREET);
  const U = bu.reduce((a, x) => a + x, 0) + (nu + 1) * STREET;
  let V = 0;
  const lineV: number[] = []; // dónde empieza cada calle a lo largo, desde arriba del pueblo
  for (let j = 0; j <= nv; j++) {
    lineV.push(V);
    V += lineW(j) + (j < nv ? bv[j]! : 0);
  }
  const v0 = rv - lineV[k]!;
  if (v0 < EDGE || v0 + V > MAP_SIZE - EDGE) return null;
  if (U > MAP_SIZE - 2 * EDGE) return null;
  const u0 = nextInt(rng, EDGE, MAP_SIZE - EDGE - U);
  const town: Rect = { x: u0, y: v0, w: U, h: V };
  const streets: Band[] = [];
  for (let j = 0; j <= nv; j++)
    if (j !== k) streets.push({ rect: { x: u0, y: v0 + lineV[j]!, w: U, h: STREET }, along: true });
  const blocks: Rect[] = [];
  let u = u0;
  for (let i = 0; i <= nu; i++) {
    streets.push({ rect: { x: u, y: v0, w: STREET, h: V }, along: false });
    if (i === nu) break;
    for (let j = 0; j < nv; j++)
      blocks.push({ x: u + STREET, y: v0 + lineV[j]! + lineW(j), w: bu[i]!, h: bv[j]! });
    u += STREET + bu[i]!;
  }
  return { town, blocks, streets };
}

/** Fachada y fondo de un tipo, sorteados. */
function sizeOf(rng: RngState, kind: BuildingKind): [number, number] {
  if (kind === 'base') return BASE_SIZE;
  const spec = BUILDINGS[kind];
  return [nextInt(rng, spec.w[0], spec.w[1]), nextInt(rng, spec.h[0], spec.h[1])];
}

/** El rectángulo con la fachada (`front`) en el lado `side`. */
function oriented(side: Side, front: number, depth: number): { w: number; h: number } {
  return side === 'top' || side === 'bottom' ? { w: front, h: depth } : { w: depth, h: front };
}

const SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right'];

/** Un edificio en la manzana, pegado a una de sus calles, sin pisar a los demás. */
function inBlock(rng: RngState, block: Rect, kind: BuildingKind, lots: Lot[]): Lot | null {
  for (let k = 0; k < 30; k++) {
    const side = SIDES[nextInt(rng, 0, 3)]!;
    const [front, depth] = sizeOf(rng, kind);
    const s = oriented(side, front, depth);
    const w = Math.min(s.w, block.w);
    const h = Math.min(s.h, block.h);
    const x =
      side === 'left'
        ? block.x
        : side === 'right'
          ? block.x + block.w - w
          : nextInt(rng, block.x, block.x + block.w - w);
    const y =
      side === 'top'
        ? block.y
        : side === 'bottom'
          ? block.y + block.h - h
          : nextInt(rng, block.y, block.y + block.h - h);
    const rect = { x, y, w, h };
    if (lots.some((l) => intersects(expand(rect, GAP), l.rect))) continue;
    return { kind, rect, side };
  }
  return null;
}

/** Un edificio junto a una carretera o camino, mirándola, con su patio delante. */
function alongRoad(rng: RngState, band: Band, kind: BuildingKind): Lot | null {
  const [front, depth] = sizeOf(rng, kind);
  const yard = kind === 'gas' ? APRON : nextInt(rng, YARD[0], YARD[1]);
  const r = band.rect;
  const near = nextFloat(rng) < 0.5; // del lado de arriba/izquierda de la carretera
  let rect: Rect;
  let side: Side;
  if (band.along) {
    side = near ? 'bottom' : 'top';
    const x = nextInt(rng, r.x + EDGE, r.x + r.w - EDGE - front);
    const y = near ? r.y - yard - depth : r.y + r.h + yard;
    rect = { x, y, w: front, h: depth };
  } else {
    side = near ? 'right' : 'left';
    if (r.h - 2 * EDGE - front < 0) return null;
    const y = nextInt(rng, r.y + EDGE, r.y + r.h - EDGE - front);
    const x = near ? r.x - yard - depth : r.x + r.w + yard;
    rect = { x, y, w: depth, h: front };
  }
  if (rect.x < EDGE || rect.y < EDGE) return null;
  if (rect.x + rect.w > MAP_SIZE - EDGE || rect.y + rect.h > MAP_SIZE - EDGE) return null;
  return { kind, rect, side };
}

/** ¿Cabe sin pisar a nadie, ni explanadas, ni carreteras? */
function clear(rect: Rect, lots: Lot[], aprons: Rect[], bands: Band[]): boolean {
  if (lots.some((l) => intersects(expand(rect, GAP), l.rect))) return false;
  if (aprons.some((a) => intersects(expand(rect, GAP), a))) return false;
  return !bands.some((b) => intersects(expand(rect, 1), b.rect));
}

/** La explanada de la gasolinera: entre su fachada y la carretera. */
function apronOf(gas: Lot): Rect {
  const { x, y, w, h } = gas.rect;
  if (gas.side === 'bottom') return { x: x - 1, y: y + h, w: w + 2, h: APRON };
  if (gas.side === 'top') return { x: x - 1, y: y - APRON, w: w + 2, h: APRON };
  if (gas.side === 'right') return { x: x + w, y: y - 1, w: APRON, h: h + 2 };
  return { x: x - APRON, y: y - 1, w: APRON, h: h + 2 };
}

function transpose(r: Rect): Rect {
  return { x: r.y, y: r.x, w: r.h, h: r.w };
}

function turnSide(s: Side): Side {
  return s === 'top' ? 'left' : s === 'bottom' ? 'right' : s === 'left' ? 'top' : 'bottom';
}

function paint(grid: Grid, r: Rect): void {
  for (let y = Math.max(0, r.y); y < Math.min(grid.height, r.y + r.h); y++)
    for (let x = Math.max(0, r.x); x < Math.min(grid.width, r.x + r.w); x++)
      setTile(grid, x, y, Tile.Road);
}

/** Árboles: pocos junto a las carreteras y en el pueblo, más cuanto más lejos (bosque). */
function placeTrees(grid: Grid, rng: RngState, lots: Lot[], town: Rect): void {
  const dist = roadDistance(grid);
  const zones = lots.map((l) => expand(l.rect, 2));
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      if (getTile(grid, x, y) !== Tile.Grass) continue;
      const d = contains(town, { x, y }) ? 0 : dist[y * grid.width + x]!;
      const f = Math.min(1, Math.max(0, (d - TREES_NEAR) / (TREES_FAR - TREES_NEAR)));
      const density = TREE_DENSITY_NEAR + f * (TREE_DENSITY_FAR - TREE_DENSITY_NEAR);
      if (nextFloat(rng) >= density) continue;
      if (zones.some((z) => contains(z, { x, y }))) continue;
      setTile(grid, x, y, Tile.Tree);
    }
}

/** Distancia (en pasos, sin diagonales) de cada casilla a la carretera más cercana. */
function roadDistance(grid: Grid): number[] {
  const n = grid.width * grid.height;
  const dist = new Array<number>(n).fill(Infinity);
  const queue: number[] = [];
  for (let i = 0; i < n; i++)
    if (grid.tiles[i] === Tile.Road) {
      dist[i] = 0;
      queue.push(i);
    }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % grid.width;
    const y = (i - x) / grid.width;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      const j = ny * grid.width + nx;
      if (dist[j]! <= dist[i]! + 1) continue;
      dist[j] = dist[i]! + 1;
      queue.push(j);
    }
  }
  return dist;
}

/** Baraja (Fisher–Yates) con el azar dado. */
function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
