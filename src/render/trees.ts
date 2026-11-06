import { Tile, type Grid } from '../sim/types';
import { MAP_ART as A } from './colors';
import { hash2 } from './look';

const T = 16;
/** El dibujo de un árbol: la copa sale de su casilla. */
const SIZE = 32;
/** Dónde va el dibujo respecto a su casilla: la copa, centrada y algo arriba; el tronco, abajo. */
const OFFSET = { x: -8, y: -10 };
const CENTER = { x: 16, y: 13 };
const RADII = [8, 9, 10];

/** Las copas (A1): cada una con su sombra aparte, para pintar todas las sombras primero. */
export interface TreeArt {
  trees: HTMLCanvasElement[];
  shadows: HTMLCanvasElement[];
}

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(draw: (img: ImageData) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  draw(img);
  ctx.putImageData(img, 0, 0);
  return c;
}

function put(img: ImageData, x: number, y: number, c: number, a = 1): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const k = (y * SIZE + x) * 4;
  img.data[k] = c >> 16;
  img.data[k + 1] = (c >> 8) & 255;
  img.data[k + 2] = c & 255;
  img.data[k + 3] = Math.round(a * 255);
}

/**
 * Una copa redonda hecha de cuatro bultos, con luz arriba a la izquierda, un borde oscuro y el
 * tronco asomando por debajo.
 */
function tree(r: number, tones: readonly number[], seed: number): HTMLCanvasElement {
  const rnd = rng(seed);
  const j = () => (rnd() - 0.5) * r * 0.2;
  const blobs = [
    [0, 0, r],
    [-r * 0.55 + j(), r * 0.25 + j(), r * 0.6],
    [r * 0.55 + j(), r * 0.3 + j(), r * 0.6],
    [j(), -r * 0.45 + j(), r * 0.6],
  ] as const;
  const inside = (x: number, y: number) =>
    blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br);
  return canvas((img) => {
    const { x: cx, y: cy } = CENTER;
    for (let y = cy + 2; y < cy + 12; y++) {
      put(img, cx - 1, y, A.trunkLight);
      put(img, cx, y, A.trunk);
      put(img, cx + 1, y, A.trunk);
    }
    for (let y = -r - 3; y <= r + 3; y++)
      for (let x = -r - 3; x <= r + 3; x++) {
        if (!inside(x, y)) {
          if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1))
            put(img, cx + x, cy + y, A.canopyEdge);
          continue;
        }
        const light = (-x - y) / (r * 1.4) + (rnd() - 0.5) * 0.6;
        const k = light > 0.55 ? 0 : light > 0.1 ? 1 : light > -0.4 ? 2 : 3;
        put(img, cx + x, cy + y, tones[k]!);
      }
  });
}

/** La sombra de una copa: una elipse en el suelo, abajo a la derecha. */
function shadow(r: number): HTMLCanvasElement {
  return canvas((img) => {
    const [sx, sy, rx, ry] = [CENTER.x + 4, CENTER.y + 9, r, r * 0.55];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2 <= 1) put(img, x, y, 0, A.treeShadow);
  });
}

export function makeTreeArt(): TreeArt {
  const trees: HTMLCanvasElement[] = [];
  const shadows: HTMLCanvasElement[] = [];
  A.canopies.forEach((tones, p) =>
    RADII.forEach((r, k) => {
      trees.push(tree(r, tones, 77 + p * 10 + k));
      shadows.push(shadow(r));
    }),
  );
  return { trees, shadows };
}

/** Una zona del mapa, en casillas (de `x0`, `y0` hasta `x1`, `y1`, incluidas). */
export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Hasta dónde llega un árbol fuera de su casilla (la copa o la sombra), en casillas. */
export const TREE_REACH = 1;

/** ¿Llega aquí la copa o la sombra de algún árbol? */
export function nearTree(g: Grid, x: number, y: number): boolean {
  for (let dy = -TREE_REACH; dy <= TREE_REACH; dy++)
    for (let dx = -TREE_REACH; dx <= TREE_REACH; dx++) {
      const [tx, ty] = [x + dx, y + dy];
      if (tx < 0 || ty < 0 || tx >= g.width || ty >= g.height) continue;
      if (g.tiles[ty * g.width + tx] === Tile.Tree) return true;
    }
  return false;
}

/**
 * Pinta los árboles encima del suelo ya pintado: los de todo el mapa o, al repintar una casilla,
 * solo lo que cae en ella. Primero todas las sombras; luego las copas, de arriba abajo, para que la
 * de delante tape a la de detrás.
 */
export function paintTrees(
  ctx: CanvasRenderingContext2D,
  art: TreeArt,
  g: Grid,
  area?: Area,
): void {
  const a = area ?? { x0: 0, y0: 0, x1: g.width - 1, y1: g.height - 1 };
  if (area) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x0 * T, a.y0 * T, (a.x1 - a.x0 + 1) * T, (a.y1 - a.y0 + 1) * T);
    ctx.clip();
  }
  const trees: [number, number, number][] = [];
  for (let y = Math.max(0, a.y0 - TREE_REACH); y <= Math.min(g.height - 1, a.y1 + TREE_REACH); y++)
    for (let x = Math.max(0, a.x0 - TREE_REACH); x <= Math.min(g.width - 1, a.x1 + TREE_REACH); x++)
      if (g.tiles[y * g.width + x] === Tile.Tree)
        trees.push([x, y, hash2(x, y) % art.trees.length]);
  for (const [x, y, v] of trees) ctx.drawImage(art.shadows[v]!, x * T + OFFSET.x, y * T + OFFSET.y);
  for (const [x, y, v] of trees) ctx.drawImage(art.trees[v]!, x * T + OFFSET.x, y * T + OFFSET.y);
  if (area) ctx.restore();
}
