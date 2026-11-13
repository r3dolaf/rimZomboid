// V4 §6: lo sembrado de cada cultivo, en sus cuatro fases (brote, mediano, grande y maduro): seis
// matas por parcela, como el huerto de V1. Filas de 16 letras (colores de PROP_COLORS; `.`, nada).
import type { CropKind } from '../sim/types';

const W = 16;
/** Dónde va cada una de las seis matas de una parcela. */
const CENTERS: readonly (readonly [number, number])[] = [
  [3, 4],
  [8, 4],
  [12, 4],
  [3, 11],
  [8, 11],
  [12, 11],
];

type Grid = string[][];
const grid = (): Grid => Array.from({ length: 16 }, () => Array<string>(W).fill('.'));
const put = (g: Grid, x: number, y: number, c: string) => {
  if (x >= 0 && x < W && y >= 0 && y < g.length) g[y]![x] = c;
};
const rows = (g: Grid): string[] => g.map((r) => r.join(''));

/** 1, 2 o 3 (brote, mediano, grande) y si está madura. */
type Stage = 1 | 2 | 3;

/** Lechuga: rosetas redondas, verde claro y con el borde rizado; madura, grandes y con el corazón claro. */
function lettuce(stage: Stage, ripe: boolean): string[] {
  const g = grid();
  const r = ripe ? 2.9 : [0, 1.0, 1.8, 2.5][stage]!;
  for (const [cx, cy] of CENTERS)
    for (let y = cy - 3; y <= cy + 2; y++)
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.15);
        if (d > r + 0.25) continue;
        let c = d < r * (ripe ? 0.55 : 0.4) ? '1' : d < r * 0.78 ? '2' : '3';
        if (c === '3' && (x + y) % 2 === 0 && stage > 1) c = '2';
        put(g, x, y, c);
      }
  return rows(g);
}

/** Col: hojas de fuera anchas, verde azulado, con nervios; la pella clara en el centro. */
function cabbage(stage: Stage, ripe: boolean): string[] {
  const g = grid();
  const out = ripe ? 3.0 : [0, 1.2, 2.2, 2.8][stage]!;
  const inner = ripe ? 1.8 : [0, 0, 0.7, 1.3][stage]!;
  for (const [cx, cy] of CENTERS)
    for (let y = cy - 3; y <= cy + 2; y++)
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.1);
        if (d <= inner) put(g, x, y, d < inner * 0.55 ? '4' : '5');
        else if (d <= out + 0.2) {
          const vein = Math.abs(x - cx) === Math.abs(y - cy) && stage > 1;
          put(g, x, y, vein ? '5' : d > out - 0.7 ? '7' : '6');
        }
      }
  return rows(g);
}

/** Patata: mata baja y oscura; grande, con flores blancas; madura, se seca y asoman las patatas. */
function potato(stage: Stage, ripe: boolean): string[] {
  const g = grid();
  const rx = ripe ? 2.8 : [0, 1.2, 2.2, 3.0][stage]!;
  const ry = rx * 0.7;
  for (const [cx, cy0] of CENTERS) {
    const cy = cy0 - 0.5;
    for (let y = Math.floor(cy - 3); y <= cy0 + 2; y++)
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d > 1.05 || (ripe && (x * 3 + y) % 4 === 0)) continue;
        put(g, x, y, ripe ? (d > 0.7 ? 'U' : 'u') : d > 0.75 ? '#' : y < cy ? 'z' : 'Z');
      }
    if (stage === 3 && !ripe) {
      put(g, cx - 1, cy0 - 2, '8');
      put(g, cx + 1, cy0 - 1, '8');
    }
    if (ripe) {
      put(g, cx - 2, cy0 + 1, '9');
      put(g, cx - 1, cy0 + 1, '0');
      put(g, cx + 1, cy0 + 2, '9');
      put(g, cx + 2, cy0 + 2, '0');
    }
  }
  return rows(g);
}

/** Tomate: crece alto, atado a una caña; tomates verdes y, maduro, rojos. */
function tomato(stage: Stage, ripe: boolean): string[] {
  const g = grid();
  const h = ripe ? 6 : [0, 2, 4, 6][stage]!;
  for (const [cx, cy] of CENTERS) {
    const base = cy + 1;
    if (stage === 1 && !ripe) {
      put(g, cx, base, 'Z');
      put(g, cx - 1, base - 1, 'z');
      put(g, cx + 1, base - 1, 'z');
      continue;
    }
    for (let k = 0; k < h; k++) put(g, cx, base - k, k === h - 1 ? 'v' : 'w'); // la caña
    for (let k = 0; k < h - 1; k++) {
      const y = base - k;
      const side = k % 2 === 0 ? -1 : 1;
      put(g, cx + side, y, 'Z');
      put(g, cx + 2 * side, y, '#');
      if (k % 2 === 1) put(g, cx - side, y - 1, 'z');
    }
    if (stage === 3 || ripe)
      for (const [dx, dy] of [
        [-1, -1],
        [1, -3],
      ] as const) {
        put(g, cx + dx, base + dy, ripe ? '+' : '%');
        put(g, cx + dx, base + dy + 1, ripe ? '*' : '#');
      }
  }
  return rows(g);
}

const DRAW: Record<CropKind, (stage: Stage, ripe: boolean) => string[]> = {
  lettuce,
  tomato,
  potato,
  cabbage,
};

/** Los dibujos de lo sembrado: `crop-<cultivo>-1|2|3|ripe`. */
export function cropSprites(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [kind, draw] of Object.entries(DRAW)) {
    for (const st of [1, 2, 3] as const) out[`crop-${kind}-${st}`] = draw(st, false);
    out[`crop-${kind}-ripe`] = draw(3, true);
  }
  return out;
}
