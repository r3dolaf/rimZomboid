import { Tile, type Grid } from '../sim/types';

/** Lo que se dibuja como parte de un muro: con su parte de arriba, su cara y su sombra (A1). */
const WALL_LIKE: ReadonlySet<Tile> = new Set([
  Tile.Wall,
  Tile.WoodWall,
  Tile.Door,
  Tile.Window,
  Tile.BoardedWindow,
  Tile.BrokenWindow,
  Tile.BrokenDoor,
  Tile.CurtainedWindow,
  Tile.LockedDoor,
]);

export function isWallLike(t: Tile): boolean {
  return WALL_LIKE.has(t);
}

/** La casilla, o `null` fuera del mapa (allí no hay muros que den sombra ni calle). */
function tileAt(g: Grid, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= g.width || y >= g.height) return null;
  return g.tiles[y * g.width + x]!;
}

const wallAt = (g: Grid, x: number, y: number) => {
  const t = tileAt(g, x, y);
  return t !== null && isWallLike(t);
};
const roadAt = (g: Grid, x: number, y: number) => tileAt(g, x, y) === Tile.Road;

/** Qué vecinos (arriba, abajo, derecha, izquierda) cumplen algo. */
export interface Sides {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

export function wallSides(g: Grid, x: number, y: number): Sides {
  return {
    n: wallAt(g, x, y - 1),
    s: wallAt(g, x, y + 1),
    e: wallAt(g, x + 1, y),
    w: wallAt(g, x - 1, y),
  };
}

export function roadSides(g: Grid, x: number, y: number): Sides {
  return {
    n: roadAt(g, x, y - 1),
    s: roadAt(g, x, y + 1),
    e: roadAt(g, x + 1, y),
    w: roadAt(g, x - 1, y),
  };
}

/**
 * La raya del centro de una calle de 2 o 3 de ancho: `h` si la calle va de lado a lado, `v` si va
 * de arriba abajo, y en qué píxeles de la casilla de 16 (de arriba abajo o de izquierda a derecha)
 * va.
 * En los cruces y en lo que no es una calle estrecha, ninguna.
 */
export interface Lane {
  dir: 'h' | 'v';
  at: number[];
}

/** Cuántas casillas de carretera seguidas hay desde (x, y) en un sentido, sin contarla, hasta `max`. */
function roadRun(g: Grid, x: number, y: number, dx: number, dy: number, max: number): number {
  let n = 0;
  while (n < max && roadAt(g, x + dx * (n + 1), y + dy * (n + 1))) n++;
  return n;
}

const LANE_AT: Record<number, number[][]> = {
  2: [[15], [0]], // entre las dos filas
  3: [[], [7, 8], []], // en medio de la del centro
};

export function laneAt(g: Grid, x: number, y: number): Lane | null {
  if (!roadAt(g, x, y)) return null;
  const up = roadRun(g, x, y, 0, -1, 3);
  const down = roadRun(g, x, y, 0, 1, 3);
  const left = roadRun(g, x, y, -1, 0, 3);
  const right = roadRun(g, x, y, 1, 0, 3);
  const across = up + down + 1; // ancho si va de lado a lado
  const along = left + right + 1;
  const lines = (width: number, index: number) => LANE_AT[width]?.[index] ?? [];
  if (across <= 3 && along > 3) {
    const at = lines(across, up);
    return at.length ? { dir: 'h', at } : null;
  }
  if (along <= 3 && across > 3) {
    const at = lines(along, left);
    return at.length ? { dir: 'v', at } : null;
  }
  return null;
}

const bits = (s: Sides) => (s.n ? 1 : 0) | (s.s ? 2 : 0) | (s.e ? 4 : 0) | (s.w ? 8 : 0);

/**
 * Un número que cambia si cambia algo de lo que se ve en la casilla: qué es (en los 4 bits de abajo),
 * si tiene cortinas, los muros de alrededor (su cara y su sombra) y, en la carretera, el arcén y la
 * raya del centro.
 */
export function tileLook(g: Grid, i: number, hung: boolean): number {
  const x = i % g.width;
  const y = (i - x) / g.width;
  const t = g.tiles[i]!;
  let look = t | (hung ? 1 << 4 : 0) | (bits(wallSides(g, x, y)) << 5);
  if (t === Tile.Road) {
    const lane = laneAt(g, x, y);
    const where = !lane ? 0 : lane.at.length === 2 ? 3 : lane.at[0] === 0 ? 1 : 2;
    const laneCode = lane?.dir === 'v' ? where + 3 : where;
    look |= (bits(roadSides(g, x, y)) << 9) | (laneCode << 13);
  }
  return look;
}

/** El tipo de casilla de un `tileLook`. */
export const lookTile = (look: number): Tile => (look & 15) as Tile;

/** Un número fijo por casilla, para elegir entre los dibujos de un mismo suelo sin repetir. */
export function hash2(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
