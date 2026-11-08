import { Tile, type Grid } from '../sim/types';
import type { Season } from '../sim/season';
import { css, FLOOR_COLORS, GRASS_BY_SEASON, MAP_ART as A, type FloorStyle } from './colors';
import { hash2, isWallLike, laneAt, roadSides, wallSides, type Sides } from './look';

const T = 16;
/** Dibujos distintos de cada suelo, para que no se note la cuadrícula. */
const VARIANTS = 8;

type Ground =
  | 'grass'
  | 'asphalt'
  | 'wood'
  | 'tiles'
  | 'concrete'
  | 'planks'
  | 'rubble'
  | 'wallTop'
  | 'woodWallTop';

/** Los dibujos de 16×16 de cada suelo y de lo de arriba de los muros (A1), hechos al empezar. */
export type TileArt = Record<Ground, HTMLCanvasElement[]>;

/** Azar con semilla, solo para que los dibujos salgan siempre iguales. */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un color un poco más claro (f > 1) o más oscuro (f < 1). */
function shade(c: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch(c >> 16) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

type Px = (x: number, y: number, c: number, a?: number) => void;

/** Un dibujo de 16×16 píxel a píxel. */
function tile(draw: (px: Px, rnd: () => number) => void, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(T, T);
  const d = img.data;
  const px: Px = (x, y, c, a = 1) => {
    if (x < 0 || y < 0 || x >= T || y >= T) return;
    const k = (y * T + x) * 4;
    const keep = d[k + 3] ? 1 - a : 0;
    d[k] = d[k]! * keep + (c >> 16) * (1 - keep);
    d[k + 1] = d[k + 1]! * keep + ((c >> 8) & 255) * (1 - keep);
    d[k + 2] = d[k + 2]! * keep + (c & 255) * (1 - keep);
    d[k + 3] = 255;
  };
  draw(px, rng(seed));
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Ruido de unos cuantos tonos: el primero, el que más sale. */
function noise(px: Px, rnd: () => number, tones: readonly number[], odds: number[]): void {
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const r = rnd();
      let k = 0;
      while (k < odds.length && r >= odds[k]!) k++;
      px(x, y, tones[Math.min(k, tones.length - 1)]!);
    }
}

const at = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const GROUNDS: Record<Ground, (px: Px, rnd: () => number) => void> = {
  grass(px, rnd) {
    noise(px, rnd, A.grass, [0.55, 0.8, 0.95]);
    for (let k = 0; k < 3; k++) {
      // Matas: una uve más clara con su sombra.
      const [x, y] = [at(rnd, 2, 13), at(rnd, 3, 13)];
      px(x, y, A.tuft);
      px(x - 1, y - 1, A.tuft);
      px(x + 1, y - 1, A.tuft);
      px(x, y + 1, A.tuftShade);
    }
    if (rnd() < 0.12) px(at(rnd, 3, 12), at(rnd, 3, 12), A.flowers[at(rnd, 0, 2)]!);
    if (rnd() < 0.15) for (let k = 0; k < 8; k++) px(at(rnd, 4, 11), at(rnd, 4, 11), A.dirt, 0.7);
  },
  asphalt(px, rnd) {
    noise(px, rnd, A.asphalt, [0.6, 0.85]);
    if (rnd() < 0.25) {
      // Una grieta.
      let [x, y] = [at(rnd, 3, 12), at(rnd, 3, 12)];
      for (let k = 0; k < 6; k++) {
        px(x, y, A.crack);
        x += rnd() < 0.5 ? 1 : 0;
        y += rnd() < 0.5 ? 1 : -1;
      }
    }
  },
  wood(px, rnd) {
    // Tablas de 4 de alto, cada una de su tono, con su junta.
    for (let p = 0; p < 4; p++) {
      const c = A.wood[at(rnd, 0, A.wood.length - 1)]!;
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < T; x++) px(x, p * 4 + y, rnd() < 0.85 ? c : A.woodGrain);
      for (let x = 0; x < T; x++) px(x, p * 4 + 3, A.woodSeam);
      const j = at(rnd, 1, 14);
      for (let y = 0; y < 3; y++) px(j, p * 4 + y, A.woodSeam);
    }
  },
  tiles(px, rnd) {
    // Baldosas de 8×8 con la junta abajo y a la derecha.
    const base = FLOOR_COLORS.tiles;
    for (let by = 0; by < 2; by++)
      for (let bx = 0; bx < 2; bx++) {
        const c = shade(base, 0.96 + rnd() * 0.08);
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const grout = x === 7 || y === 7;
            px(
              bx * 8 + x,
              by * 8 + y,
              grout ? shade(base, 0.82) : rnd() < 0.9 ? c : shade(c, 0.97),
            );
          }
      }
  },
  concrete(px, rnd) {
    const base = FLOOR_COLORS.concrete;
    noise(px, rnd, [base, shade(base, 0.95), shade(base, 1.05)], [0.6, 0.85]);
    if (rnd() < 0.2)
      for (let k = 0; k < 10; k++) px(at(rnd, 3, 12), at(rnd, 3, 12), shade(base, 0.88), 0.6);
  },
  planks(px, rnd) {
    // Tablones de granja, de arriba abajo, con sus clavos.
    const base = FLOOR_COLORS.planks;
    for (let p = 0; p < 4; p++) {
      const c = shade(base, 0.9 + rnd() * 0.15);
      for (let y = 0; y < T; y++)
        for (let x = 0; x < 3; x++) px(p * 4 + x, y, rnd() < 0.85 ? c : shade(c, 0.9));
      for (let y = 0; y < T; y++) px(p * 4 + 3, y, A.woodSeam);
      px(p * 4 + 1, at(rnd, 1, 3), A.woodSeam);
    }
  },
  rubble(px, rnd) {
    noise(px, rnd, A.rubble, [0.5, 0.8]);
    for (let k = 0; k < 6; k++) {
      // Piedras: claras arriba a la izquierda, con sombra.
      const [x, y] = [at(rnd, 1, 13), at(rnd, 1, 13)];
      px(x, y, A.stone);
      px(x + 1, y, A.stone);
      px(x, y + 1, shade(A.stone, 0.9));
      px(x + 1, y + 1, A.stoneShade);
      px(x + 2, y + 1, A.stoneShade);
    }
  },
  wallTop(px, rnd) {
    noise(px, rnd, A.wallTop, [0.8]);
  },
  woodWallTop(px, rnd) {
    for (let p = 0; p < 4; p++) {
      const c = A.woodWallTop[p % 2]!;
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < T; x++) px(x, p * 4 + y, rnd() < 0.85 ? c : shade(c, 0.9));
      for (let x = 0; x < T; x++) px(x, p * 4 + 3, A.woodWallLine);
    }
  },
};

export function makeTileArt(season: Season = 'summer'): TileArt {
  const art = {} as TileArt;
  (Object.keys(GROUNDS) as Ground[]).forEach((g, k) => {
    // V3: la hierba, con los tonos de la estación (en verano, los de siempre).
    const draw: (px: Px, rnd: () => number) => void =
      g === 'grass'
        ? (px, rnd) => noise(px, rnd, GRASS_BY_SEASON[season], [0.55, 0.8, 0.95])
        : GROUNDS[g];
    art[g] = Array.from({ length: VARIANTS }, (_, v) => tile(draw, 1000 * (k + 1) + v));
  });
  return art;
}

const FLOOR_GROUND: Record<FloorStyle, Ground> = {
  tiles: 'tiles',
  concrete: 'concrete',
  planks: 'planks',
};

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: number,
  a = 1,
): void {
  ctx.globalAlpha = a;
  ctx.fillStyle = css(c);
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

/**
 * Pinta la casilla `i` del mapa: su suelo (con la sombra de los muros de arriba y de la izquierda)
 * o su muro (con la cara si debajo no hay muro), y en la carretera, el arcén y la raya del centro.
 */
export function paintTile(
  ctx: CanvasRenderingContext2D,
  art: TileArt,
  g: Grid,
  i: number,
  hung: boolean,
  floor: FloorStyle | null,
): void {
  const x = i % g.width;
  const y = (i - x) / g.width;
  const [x0, y0] = [x * T, y * T];
  const t = g.tiles[i]!;
  const v = hash2(x, y) % VARIANTS;
  const walls = wallSides(g, x, y);
  const ground = (k: Ground) => ctx.drawImage(art[k][v]!, x0, y0);
  if (isWallLike(t)) return paintWall(ctx, art, x0, y0, t, v, walls, hung, floor);
  switch (t) {
    case Tile.Road:
      ground('asphalt');
      paintRoad(ctx, g, x, y);
      break;
    case Tile.Floor:
      ground(floor ? FLOOR_GROUND[floor] : 'wood');
      break;
    case Tile.Rubble:
      ground('rubble');
      break;
    case Tile.Tree:
      // La copa se pinta después, encima de todo el suelo (trees.ts); aquí, la hierba y las raíces.
      ground('grass');
      for (const [dx, dy] of [
        [6, 13],
        [9, 13],
        [7, 14],
        [8, 14],
        [5, 14],
        [10, 14],
      ] as const)
        rect(ctx, x0 + dx, y0 + dy, 1, 1, A.roots, 0.8);
      break;
    default:
      ground('grass');
  }
  // Sombra de los muros: abajo y a la derecha de ellos.
  if (walls.n) {
    rect(ctx, x0, y0, T, 3, 0, A.wallShadow);
    rect(ctx, x0, y0 + 3, T, 2, 0, A.wallShadow / 2);
  }
  if (walls.w) {
    const top = walls.n ? 5 : 3;
    rect(ctx, x0, y0 + top, 3, T - top, 0, A.wallShadow * 0.75);
    rect(ctx, x0 + 3, y0 + top, 1, T - top, 0, A.wallShadow / 3);
  }
}

/** El arcén donde acaba la carretera y la raya del centro, a trozos de 8 y gastada. */
function paintRoad(ctx: CanvasRenderingContext2D, g: Grid, x: number, y: number): void {
  const [x0, y0] = [x * T, y * T];
  const road = roadSides(g, x, y);
  const inside = (dx: number, dy: number) =>
    x + dx >= 0 && y + dy >= 0 && x + dx < g.width && y + dy < g.height;
  if (!road.n && inside(0, -1)) rect(ctx, x0, y0, T, 1, A.shoulder);
  if (!road.s && inside(0, 1)) rect(ctx, x0, y0 + T - 1, T, 1, A.shoulder);
  if (!road.w && inside(-1, 0)) rect(ctx, x0, y0, 1, T, A.shoulder);
  if (!road.e && inside(1, 0)) rect(ctx, x0 + T - 1, y0, 1, T, A.shoulder);
  const lane = laneAt(g, x, y);
  if (!lane) return;
  for (let k = 0; k < T; k++) {
    const along = lane.dir === 'h' ? x0 + k : y0 + k;
    if (((along >> 3) & 1) === 1 || hash2(along, lane.dir === 'h' ? y : x) % 7 === 0) continue;
    for (const p of lane.at)
      if (lane.dir === 'h') rect(ctx, x0 + k, y0 + p, 1, 1, A.lane);
      else rect(ctx, x0 + p, y0 + k, 1, 1, A.lane);
  }
}

/**
 * Un muro, una ventana o una puerta: arriba, el muro visto desde arriba con los bordes de fuera
 * claros (o oscuros a la derecha); abajo, si debajo no hay muro, su cara de ladrillo o de tablas.
 */
function paintWall(
  ctx: CanvasRenderingContext2D,
  art: TileArt,
  x0: number,
  y0: number,
  t: Tile,
  v: number,
  s: Sides,
  hung: boolean,
  floor: FloorStyle | null,
): void {
  const wood = t === Tile.WoodWall;
  const face = !s.s;
  const topH = face ? 9 : T;
  ctx.drawImage(art[wood ? 'woodWallTop' : 'wallTop'][v]!, 0, 0, T, topH, x0, y0, T, topH);
  const light = wood ? A.woodWallLight : A.wallLight;
  const dark = wood ? A.woodWallDark : A.wallDark;
  if (!s.n) rect(ctx, x0, y0, T, 1, light);
  if (!s.w) rect(ctx, x0, y0, 1, topH, light);
  if (!s.e) rect(ctx, x0 + T - 1, y0, 1, topH, dark);
  if (face) {
    rect(ctx, x0, y0 + 9, T, 7, wood ? A.woodWallFace : A.wallFace);
    rect(ctx, x0, y0 + 9, T, 1, wood ? A.woodWallLine : A.wallFaceTop);
    if (wood) for (const dx of [3, 7, 11, 15]) rect(ctx, x0 + dx, y0 + 10, 1, 6, A.woodWallLine);
    else {
      // Ladrillos: dos hileras, cada una con las juntas a un lado.
      for (const dy of [12, 15]) rect(ctx, x0, y0 + dy, T, 1, A.wallMortar);
      for (const dx of [0, 8]) {
        rect(ctx, x0 + dx, y0 + 10, 1, 2, A.wallMortar);
        rect(ctx, x0 + dx + 4, y0 + 13, 1, 2, A.wallMortar);
      }
    }
    if (!s.e) rect(ctx, x0 + T - 1, y0 + 9, 1, 7, dark);
  }
  switch (t) {
    case Tile.Window:
    case Tile.BoardedWindow:
    case Tile.BrokenWindow:
    case Tile.CurtainedWindow:
      return paintWindow(ctx, x0, y0, t, s, face, hung);
    case Tile.Door:
    case Tile.LockedDoor:
    case Tile.BrokenDoor:
      return paintDoor(ctx, art, x0, y0, t, v, s, floor);
  }
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Dónde va el cristal: en la cara del muro si se ve; si no, a lo largo del muro, desde arriba. */
function windowBox(s: Sides, face: boolean): { frame: Box; glass: Box; long: 'h' | 'v' } {
  if (face)
    return { frame: { x: 3, y: 9, w: 10, h: 6 }, glass: { x: 4, y: 10, w: 8, h: 4 }, long: 'h' };
  if (s.e || s.w)
    return { frame: { x: 1, y: 5, w: 14, h: 6 }, glass: { x: 2, y: 6, w: 12, h: 4 }, long: 'h' };
  return { frame: { x: 5, y: 1, w: 6, h: 14 }, glass: { x: 6, y: 2, w: 4, h: 12 }, long: 'v' };
}

function paintWindow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  t: Tile,
  s: Sides,
  face: boolean,
  hung: boolean,
): void {
  const { frame: f, glass: gl, long } = windowBox(s, face);
  const h = long === 'h';
  const [gx, gy] = [x0 + gl.x, y0 + gl.y];
  rect(ctx, x0 + f.x, y0 + f.y, f.w, f.h, A.frame);
  switch (t) {
    case Tile.Window:
      rect(ctx, gx, gy, gl.w, gl.h, A.glass);
      rect(ctx, gx, gy, h ? 3 : 1, h ? 1 : 3, A.glassShine);
      if (hung) {
        // Cortinas abiertas (H4d): recogidas a los dos lados.
        const [dw, dh] = h ? [2, gl.h] : [gl.w, 3];
        rect(ctx, gx, gy, dw, dh, A.drape);
        rect(ctx, h ? gx + gl.w - 2 : gx, h ? gy : gy + gl.h - 3, dw, dh, A.drape);
      }
      return;
    case Tile.CurtainedWindow:
      // Cortinas corridas: tela con sus pliegues.
      rect(ctx, gx, gy, gl.w, gl.h, A.drape);
      for (let k = 1; k < (h ? gl.w : gl.h); k += 2)
        if (h) rect(ctx, gx + k, gy, 1, gl.h, A.drapeFold);
        else rect(ctx, gx, gy + k, gl.w, 1, A.drapeFold);
      return;
    case Tile.BrokenWindow:
      rect(ctx, gx, gy, gl.w, gl.h, A.brokenGlass);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [gl.w - 1, gl.h - 1],
        [gl.w - 2, gl.h - 1],
      ] as const)
        rect(ctx, gx + dx, gy + dy, 1, 1, A.shard);
      return;
    case Tile.BoardedWindow: {
      // Tapiada (H4a): tablas clavadas de lado a lado, por encima del marco.
      rect(ctx, gx, gy, gl.w, gl.h, A.brokenGlass);
      const rows = h ? [gy - 1, gy + gl.h - 1] : [gy + 1, gy + 5, gy + 9];
      for (const by of rows) {
        rect(ctx, x0 + f.x - 1, by, f.w + 2, 2, A.board);
        rect(ctx, x0 + f.x - 1, by + 1, f.w + 2, 1, A.boardSeam);
      }
      return;
    }
  }
}

function paintDoor(
  ctx: CanvasRenderingContext2D,
  art: TileArt,
  x0: number,
  y0: number,
  t: Tile,
  v: number,
  s: Sides,
  floor: FloorStyle | null,
): void {
  // En un muro de lado a lado la puerta se ve de frente; en uno de arriba abajo, desde arriba.
  const front = s.e || s.w;
  const frame: Box = front ? { x: 2, y: 0, w: 12, h: T } : { x: 0, y: 2, w: T, h: 12 };
  const leaf: Box = front ? { x: 3, y: 1, w: 10, h: 15 } : { x: 1, y: 3, w: 15, h: 10 };
  rect(ctx, x0 + frame.x, y0 + frame.y, frame.w, frame.h, A.doorFrame);
  if (t === Tile.BrokenDoor) {
    // Rota (H4b): el hueco con el suelo de dentro y unas astillas junto a las bisagras.
    const src = art[floor ? FLOOR_GROUND[floor] : 'wood'][v]!;
    ctx.drawImage(src, leaf.x, leaf.y, leaf.w, leaf.h, x0 + leaf.x, y0 + leaf.y, leaf.w, leaf.h);
    for (const k of [0, 2, 3, 6, 9, 11])
      if (front) rect(ctx, x0 + leaf.x, y0 + leaf.y + k, k % 3 === 0 ? 2 : 1, 1, A.door);
      else rect(ctx, x0 + leaf.x + k, y0 + leaf.y, 1, k % 3 === 0 ? 2 : 1, A.door);
    return;
  }
  rect(ctx, x0 + leaf.x, y0 + leaf.y, leaf.w, leaf.h, A.door);
  for (const k of [3, 6])
    if (front) rect(ctx, x0 + leaf.x + k, y0 + leaf.y, 1, leaf.h, A.doorLine);
    else rect(ctx, x0 + leaf.x, y0 + leaf.y + k, leaf.w, 1, A.doorLine);
  if (front) rect(ctx, x0 + leaf.x + 8, y0 + 8, 1, 2, A.knob);
  else rect(ctx, x0 + 8, y0 + leaf.y + 8, 2, 1, A.knob);
  if (t === Tile.LockedDoor) {
    // Atrancada (H4d): dos tablones cruzados.
    ctx.strokeStyle = css(A.lockBar);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + leaf.x, y0 + leaf.y);
    ctx.lineTo(x0 + leaf.x + leaf.w, y0 + leaf.y + leaf.h);
    ctx.moveTo(x0 + leaf.x + leaf.w, y0 + leaf.y);
    ctx.lineTo(x0 + leaf.x, y0 + leaf.y + leaf.h);
    ctx.stroke();
  }
}
