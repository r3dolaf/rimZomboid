// Línea de visión con shadowcasting simétrico por cuadrantes.
import { VISION_DAY, VISION_EVERY_TICKS, VISION_NIGHT } from './balance';
import { darkness } from './clock';
import { getTile, inBounds } from './map/grid';
import { visionFor } from './furniture';
import { Tile, type Grid, type Point, type World } from './types';

/** Muros, árboles, puertas y ventanas tapiadas tapan la vista; las ventanas no. Fuera del mapa, opaco. */
export function isOpaque(g: Grid, x: number, y: number): boolean {
  const t = getTile(g, x, y);
  return (
    t === Tile.Wall ||
    t === Tile.Tree ||
    t === Tile.Door ||
    t === Tile.WoodWall ||
    t === Tile.BoardedWindow
  );
}

export function visionRadius(tick: number): number {
  return Math.round(VISION_DAY - (VISION_DAY - VISION_NIGHT) * darkness(tick));
}

// Shadowcasting simétrico (Albert Ford, 2020): si A ve a B, B ve a A. Además, no se ve a través
// de huecos diagonales entre casillas opacas. Las pendientes son fracciones exactas n/d (d > 0)
// para no depender del redondeo de los decimales.

interface Slope {
  n: number;
  d: number;
}

/** Pendiente del borde izquierdo de la casilla `col` en la fila `depth`: (2·col − 1) / (2·depth). */
const slopeAt = (depth: number, col: number): Slope => ({ n: 2 * col - 1, d: 2 * depth });

/**
 * Llama a `mark` con cada casilla visible desde (ox, oy) dentro de `radius`, incluidas las
 * opacas que se ven (muros, árboles, puertas).
 */
export function computeFov(
  g: Grid,
  ox: number,
  oy: number,
  radius: number,
  mark: (x: number, y: number) => void,
): void {
  if (inBounds(g, ox, oy)) mark(ox, oy);
  const r2 = radius * radius;

  for (let q = 0; q < 4; q++) {
    // Cuadrantes norte, este, sur y oeste: (fila, columna) → (x, y).
    const toX = (row: number, col: number) =>
      q === 0 || q === 2 ? ox + col : q === 1 ? ox + row : ox - row;
    const toY = (row: number, col: number) => (q === 0 ? oy - row : q === 2 ? oy + row : oy + col);

    const scan = (depth: number, start: Slope, end: Slope): void => {
      if (depth > radius) return;
      // Columnas cuyo centro cae en el sector (redondeando las mitades hacia dentro).
      const minCol = Math.floor((2 * depth * start.n + start.d) / (2 * start.d));
      const maxCol = Math.ceil((2 * depth * end.n - end.d) / (2 * end.d));
      let prev: 'none' | 'wall' | 'floor' = 'none';
      for (let col = minCol; col <= maxCol; col++) {
        const x = toX(depth, col);
        const y = toY(depth, col);
        const opaque = isOpaque(g, x, y);
        // Hueco diagonal: si las dos vecinas hacia el observador son opacas, no se ve a través.
        const sx = Math.sign(x - ox);
        const sy = Math.sign(y - oy);
        const corner =
          !opaque && sx !== 0 && sy !== 0 && isOpaque(g, x - sx, y) && isOpaque(g, x, y - sy);
        const wall = opaque || corner;
        const symmetric = col * start.d >= depth * start.n && col * end.d <= depth * end.n;
        const visible = opaque || (!corner && symmetric);
        if (visible && inBounds(g, x, y) && col * col + depth * depth <= r2) mark(x, y);
        if (prev === 'wall' && !wall) start = slopeAt(depth, col);
        if (prev === 'floor' && wall) scan(depth + 1, start, slopeAt(depth, col));
        prev = wall ? 'wall' : 'floor';
      }
      if (prev === 'floor') scan(depth + 1, start, end);
    };
    scan(1, { n: -1, d: 1 }, { n: 1, d: 1 });
  }
}

/** Casillas que ven ahora los supervivientes (1 = visible), por índice y·ancho + x. */
export function visibleTiles(w: World): Uint8Array {
  const out = new Uint8Array(w.grid.width * w.grid.height);
  for (const s of w.survivors)
    computeFov(w.grid, Math.floor(s.pos.x), Math.floor(s.pos.y), visionFor(w, s), (x, y) => {
      out[y * w.grid.width + x] = 1;
    });
  return out;
}

/** Marca como vistas las casillas que ven los supervivientes. Cada VISION_EVERY_TICKS. */
export function visionSystem(w: World): void {
  if (w.tick % VISION_EVERY_TICKS !== 0) return;
  revealFromSurvivors(w);
}

export function revealFromSurvivors(w: World): void {
  for (const s of w.survivors)
    computeFov(w.grid, Math.floor(s.pos.x), Math.floor(s.pos.y), visionFor(w, s), (x, y) => {
      w.seen[y * w.grid.width + x] = 1;
    });
}

/**
 * ¿Se ve la casilla `b` desde la `a`? Línea recta entre sus centros (Bresenham): la tapan las
 * casillas opacas de en medio y los huecos en diagonal entre dos opacas. Para los zombis y para
 * saber qué zombis ve un colono.
 */
export function lineOfSight(g: Grid, a: Point, b: Point): boolean {
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = Math.sign(b.x - a.x);
  const sy = Math.sign(b.y - a.y);
  let err = dx + dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    let nx = x;
    let ny = y;
    if (e2 >= dy) {
      err += dy;
      nx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ny += sy;
    }
    if (nx !== x && ny !== y && isOpaque(g, nx, y) && isOpaque(g, x, ny)) return false;
    x = nx;
    y = ny;
    if ((x !== b.x || y !== b.y) && isOpaque(g, x, y)) return false;
  }
  return true;
}
