// Línea de visión con shadowcasting recursivo por octantes.
import { VISION_DAY, VISION_EVERY_TICKS, VISION_NIGHT } from './balance';
import { darkness } from './clock';
import { getTile, inBounds } from './map/grid';
import { Tile, type Grid, type World } from './types';

/** Muros, árboles y puertas tapan la vista; las ventanas no. Fuera del mapa, opaco. */
export function isOpaque(g: Grid, x: number, y: number): boolean {
  const t = getTile(g, x, y);
  return t === Tile.Wall || t === Tile.Tree || t === Tile.Door;
}

export function visionRadius(tick: number): number {
  return Math.round(VISION_DAY - (VISION_DAY - VISION_NIGHT) * darkness(tick));
}

// Transformaciones de los 8 octantes: [xx, xy, yx, yy].
const OCTANTS: readonly [number, number, number, number][] = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
];

/** Llama a `mark` con cada casilla visible desde (ox, oy), incluidas las que tapan. */
export function computeFov(
  g: Grid,
  ox: number,
  oy: number,
  radius: number,
  mark: (x: number, y: number) => void,
): void {
  if (inBounds(g, ox, oy)) mark(ox, oy);
  for (const [xx, xy, yx, yy] of OCTANTS)
    castLight(g, ox, oy, radius, 1, 1, 0, xx, xy, yx, yy, mark);
}

function castLight(
  g: Grid,
  ox: number,
  oy: number,
  radius: number,
  row: number,
  start: number,
  end: number,
  xx: number,
  xy: number,
  yx: number,
  yy: number,
  mark: (x: number, y: number) => void,
): void {
  if (start < end) return;
  const r2 = radius * radius;
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let blocked = false;
    for (let dx = -j; dx <= 0; dx++) {
      const dy = -j;
      const x = ox + dx * xx + dy * xy;
      const y = oy + dx * yx + dy * yy;
      const leftSlope = (dx - 0.5) / (dy + 0.5);
      const rightSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rightSlope) continue;
      if (end > leftSlope) break;
      if (dx * dx + dy * dy <= r2 && inBounds(g, x, y)) mark(x, y);
      const opaque = isOpaque(g, x, y);
      if (blocked) {
        if (opaque) {
          newStart = rightSlope;
        } else {
          blocked = false;
          start = newStart;
        }
      } else if (opaque && j < radius) {
        blocked = true;
        castLight(g, ox, oy, radius, j + 1, start, leftSlope, xx, xy, yx, yy, mark);
        newStart = rightSlope;
      }
    }
    if (blocked) break;
  }
}

/** Casillas que ven ahora los supervivientes (1 = visible), por índice y·ancho + x. */
export function visibleTiles(w: World): Uint8Array {
  const out = new Uint8Array(w.grid.width * w.grid.height);
  const r = visionRadius(w.tick);
  for (const s of w.survivors)
    computeFov(w.grid, Math.floor(s.pos.x), Math.floor(s.pos.y), r, (x, y) => {
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
  const r = visionRadius(w.tick);
  for (const s of w.survivors)
    computeFov(w.grid, Math.floor(s.pos.x), Math.floor(s.pos.y), r, (x, y) => {
      w.seen[y * w.grid.width + x] = 1;
    });
}
