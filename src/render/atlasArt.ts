import type { Atlas, Terrain } from '../sim/types';
import { HEX_PX } from '../ui/worldView';
import { ATLAS_ART, ATLAS_TERRAIN, css } from './colors';
import { hash2 } from './look';

/** Un adorno del mapa del mundo (A6): qué es, dónde (respecto al centro del hexágono) y cuál. */
export interface Decor {
  kind: 'tree' | 'mound' | 'wave' | 'tuft' | 'house';
  dx: number;
  dy: number;
  v: number;
}

/** Sitios para adornos dentro de un hexágono (de radio 20), sin salirse. */
const SPOTS: readonly [number, number][] = [
  [-9, -7],
  [0, -10],
  [9, -7],
  [-11, 1],
  [-3, -2],
  [5, -1],
  [11, 2],
  [-7, 8],
  [1, 7],
  [8, 9],
];

/** Cuántos adornos lleva cada terreno: el bosque, árboles; las colinas, lomas; el agua, olas… */
const DECOR: Record<Terrain, { kind: Decor['kind']; min: number; max: number }> = {
  forest: { kind: 'tree', min: 5, max: 7 },
  hills: { kind: 'mound', min: 2, max: 3 },
  water: { kind: 'wave', min: 2, max: 4 },
  field: { kind: 'tuft', min: 2, max: 4 },
};

/**
 * Los adornos de un hexágono visto, siempre los mismos: los del terreno o, en un pueblo, sus casitas;
 * en la base, ninguno (ya lleva su icono). De arriba abajo, para que el de delante tape al de detrás.
 */
export function hexDecor(atlas: Atlas, i: number): Decor[] {
  if (atlas.seen[i] !== 1 || i === atlas.base) return [];
  const town = atlas.town[i] === 1;
  const spec = town ? { kind: 'house' as const, min: 4, max: 5 } : DECOR[atlas.terrain[i]!];
  const n = spec.min + (hash2(i, 41) % (spec.max - spec.min + 1));
  const start = hash2(i, 43) % SPOTS.length;
  const out: Decor[] = [];
  for (let k = 0; k < n; k++) {
    const [x, y] = SPOTS[(start + k * 3) % SPOTS.length]!;
    // Un poco movido, para que no se vea el molde.
    const jx = (hash2(i, 50 + k) % 3) - 1;
    const jy = (hash2(i, 60 + k) % 3) - 1;
    out.push({ kind: spec.kind, dx: x + jx, dy: y + jy, v: hash2(i, 70 + k) % 3 });
  }
  return out.sort((a, b) => a.dy - b.dy);
}

/**
 * Los adornos, a mano letra a letra: `k` borde, `g`/`G`/`d` copa, `w` tronco, `l`/`L`/`s` loma,
 * `a` ola, `t` mata, `r`/`R` tejado, `h` pared y `D` puerta. Se dibujan centrados en su sitio.
 */
export const DECOR_SPRITES: Record<Decor['kind'], readonly string[]> = {
  tree: ['..kkk..', '.kgggk.', 'kgGGgGk', 'kGGGGdk', 'kGGGddk', '.kddkk.', '..kwk..'],
  mound: ['...kkkkk...', '..kllllLk..', '.kllllLLLk.', 'kllllLLLLsk', 'kLLLLLLsssk', '.kkkkkkkkk.'],
  wave: ['.aaa.', 'a...a'],
  tuft: ['.t.', 't.t'],
  house: ['...kk...', '..krrk..', '.krrrRk.', 'krrrRRRk', 'khhhhhhk', 'khDhhhhk', 'kkkkkkkk'],
};

/** Un color un poco más claro (f > 1) o más oscuro (f < 1). */
function shade(c: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch(c >> 16) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/** El color de cada letra de los adornos (la casa, con uno de tres tejados). */
function decorColor(ch: string, v: number): number {
  const A = ATLAS_ART;
  switch (ch) {
    case 'k':
      return A.outline;
    case 'g':
      return A.canopy[0];
    case 'G':
      return A.canopy[1];
    case 'd':
      return A.canopy[2];
    case 'w':
      return A.trunk;
    case 'l':
      return shade(ATLAS_TERRAIN.hills, 1.18);
    case 'L':
      return ATLAS_TERRAIN.hills;
    case 's':
      return shade(ATLAS_TERRAIN.hills, 0.72);
    case 'a':
      return A.waveLight;
    case 't':
      return shade(ATLAS_TERRAIN.field, 1.22);
    case 'r':
      return A.roofs[v % A.roofs.length]!;
    case 'R':
      return shade(A.roofs[v % A.roofs.length]!, 0.75);
    case 'h':
      return A.wall;
    default:
      return A.door;
  }
}

/** Ruido de tres tonos del color de cada terreno (y de la niebla), para rellenar los hexágonos. */
function pattern(base: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(32, 32);
  for (let i = 0; i < 32 * 32; i++) {
    const r = hash2(i, seed) % 100;
    const col =
      r < 60 ? base : r < 82 ? shade(base, 1.07) : r < 97 ? shade(base, 0.92) : shade(base, 1.18);
    img.data[i * 4] = col >> 16;
    img.data[i * 4 + 1] = (col >> 8) & 255;
    img.data[i * 4 + 2] = col & 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Los rellenos de cada terreno y de la niebla, hechos una vez. */
export interface AtlasArt {
  terrain: Record<Terrain, HTMLCanvasElement>;
  fog: HTMLCanvasElement;
}

export function makeAtlasArt(): AtlasArt {
  const terrain = {} as Record<Terrain, HTMLCanvasElement>;
  (Object.keys(ATLAS_TERRAIN) as Terrain[]).forEach((t, k) => {
    terrain[t] = pattern(ATLAS_TERRAIN[t], 900 + k);
  });
  return { terrain, fog: pattern(ATLAS_ART.fog, 990) };
}

/** Pinta un adorno centrado en (x, y), con su sombra abajo a la derecha. */
export function paintDecor(ctx: CanvasRenderingContext2D, d: Decor, x: number, y: number): void {
  const rows = DECOR_SPRITES[d.kind];
  const [w, h] = [rows[0]!.length, rows.length];
  const [x0, y0] = [Math.round(x - w / 2), Math.round(y - h / 2)];
  if (d.kind !== 'wave' && d.kind !== 'tuft') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x0 + 2, y0 + h - 1, w - 2, 2);
  }
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      ctx.fillStyle = css(decorColor(ch, d.v));
      ctx.fillRect(x0 + c, y0 + r, 1, 1);
    }),
  );
}

/** El radio con que se rellenan los hexágonos: medio píxel más, para que no queden rendijas. */
export const FILL_RADIUS = HEX_PX + 0.5;
