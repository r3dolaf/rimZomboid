import { GROW_HOURS } from '../sim/balance';
import { bagsIn } from '../sim/bags';
import { ITEM_KINDS, type Inventory } from '../sim/items';
import type { Plot } from '../sim/types';
import { PROP_COLORS } from './colors';

/** Cada dibujo de mueble (A2): 16 de ancho y hasta 24 de alto; la casilla son las 16 filas de abajo. */
export const PROP_W = 16;
export const PROP_H = 24;
/** Lo que un mueble alto (nevera, armario…) puede salir por encima de su casilla. */
export const PROP_OVERFLOW = PROP_H - 16;

/**
 * Dibujos a mano, fila a fila, con una letra por píxel (`PROP_COLORS`; `.` es transparente). Se
 * colocan pegados abajo: la última fila es la de abajo de la casilla.
 */
export const PROP_SPRITES: Record<string, readonly string[]> = {
  bed: [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kvvvvvvvvvvvvk.',
    '.kwwwwwwwwwwwwk.',
    '.kWppppppppppWk.',
    '.kWppppppppppWk.',
    '.kWPPPPPPPPPPWk.',
    '.kWnnnnnnnnnnWk.',
    '.kWbbbbbbbbbbWk.',
    '.kWbbbbbbbbbbWk.',
    '.kWbbnnnnnnbbWk.',
    '.kWbbbbbbbbbbWk.',
    '.kWbbbbbbbbbbWk.',
    '.kWBBBBBBBBBBWk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
  ],
  // Cama de hospital (H5 §6): de metal, blanca y con la cruz roja.
  bedMedical: [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kIIIIIIIIIIIIk.',
    '.kjjjjjjjjjjjjk.',
    '.kjppppppppppjk.',
    '.kjppppppppppjk.',
    '.kjPPPPPPPPPPjk.',
    '.kjiiiiiiiiiijk.',
    '.kjiiiirriiiijk.',
    '.kjiiiirriiiijk.',
    '.kjiirrrrrriijk.',
    '.kjiiiirriiiijk.',
    '.kjiiiirriiiijk.',
    '.kjIIIIIIIIIIjk.',
    '.kjjjjjjjjjjjjk.',
    '.kkkkkkkkkkkkkk.',
  ],
  fridge: [
    '..kkkkkkkkkkkk..',
    '..kiiiiiiiiiik..',
    '..kiiiiiiiiiik..',
    '..kjjjjjjjjjjk..',
    '..kiIIIIIIIJIk..',
    '..kiIIIIIIIJIk..',
    '..kiIIIIIIIIIk..',
    '..kjjjjjjjjjjk..',
    '..kiIIIIIIIIIk..',
    '..kiIIIIIIIJIk..',
    '..kiIIIIIIIJIk..',
    '..kiIIIIIIIJIk..',
    '..kiIIIIIIIJIk..',
    '..kiIIIIIIIIIk..',
    '..kiIIIIIIIIIk..',
    '..kjjjjjjjjjjk..',
    '..kkkkkkkkkkkk..',
  ],
  wardrobe: [
    '.kkkkkkkkkkkkkk.',
    '.kvvvvvvvvvvvvk.',
    '.kwwwwwwwwwwwwk.',
    '.kqqqqqqqqqqqqk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwuqvuwwwWk.',
    '.kvwwwuqvuwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kvwwwwqvwwwwWk.',
    '.kWWWWWWWWWWWWk.',
    '.kkkkkkkkkkkkkk.',
  ],
  // Estantería del súper, con latas y paquetes de colores.
  shelf: [
    '.kkkkkkkkkkkkkk.',
    '.kggggggggggggk.',
    '.kGxxuummzzuuGk.',
    '.kGXXUUMMZZUUGk.',
    '.kGggggggggggGk.',
    '.kGmmzzxxuummGk.',
    '.kGMMZZXXUUMMGk.',
    '.kGggggggggggGk.',
    '.kGzzuummxxzzGk.',
    '.kGZZUUMMXXZZGk.',
    '.kGggggggggggGk.',
    '.kGuuxxzzmmxxGk.',
    '.kGUUXXZZMMXXGk.',
    '.kGggggggggggGk.',
    '.kGGGGGGGGGGGGk.',
    '.kkkkkkkkkkkkkk.',
  ],
  // Mostrador con su caja registradora.
  counter: [
    '..........kkkkk.',
    '..........kaAak.',
    'kkkkkkkkkkkhhhkk',
    'kllllllllllhhhlk',
    'kllllllllllllllk',
    'kllllllllllllllk',
    'kddddddddddddddk',
    'kLLLLLLLLLLLLLLk',
    'kLdLLLLLLLLLLdLk',
    'kLLLLLLLLLLLLLLk',
    'kddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  // Taquilla de la comisaría: alta, de metal, dos puertas con rejillas.
  locker: [
    '...kkkkkkkkkk...',
    '...kggggggggk...',
    '...khhhhhhhhk...',
    '...kgGGhgGGhk...',
    '...kgJJhgJJhk...',
    '...kgGGhgGGhk...',
    '...kgJJhgJJhk...',
    '...kgGGhgGGhk...',
    '...kgJJhgJJhk...',
    '...kgGGhgGGhk...',
    '...kgGihgGihk...',
    '...kgGihgGihk...',
    '...kgGGhgGGhk...',
    '...kgGGhgGGhk...',
    '...kgGGhgGGhk...',
    '...kgGGhgGGhk...',
    '...kgGGhgGGhk...',
    '...khhhhhhhhk...',
    '...kkkkkkkkkk...',
  ],
  // Caja de madera con su aspa.
  crate: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kvvvvvvvvvvk..',
    '..kwwwwwwwwwwk..',
    '..kvvvvvvvvvvk..',
    '..kWWWWWWWWWWk..',
    '..kWvwwwwwwvWk..',
    '..kWwvwwwwvwWk..',
    '..kWwwwvvwwwWk..',
    '..kWwwwvvwwwWk..',
    '..kWwvwwwwvwWk..',
    '..kWvwwwwwwvWk..',
    '..kWWWWWWWWWWk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  // Botiquín de la farmacia: blanco con la cruz.
  medicine: [
    '..kkkkkkkkkkkk..',
    '..kiiiiiiiiiik..',
    '..kjjjjjjjjjjk..',
    '..kIIIIIIIIIIk..',
    '..kIIIIrrIIIIk..',
    '..kIIIIrrIIIIk..',
    '..kIIrrrrrrIIk..',
    '..kIIrrrrrrIIk..',
    '..kIIIIrrIIIIk..',
    '..kIIIIrrIIIIk..',
    '..kIIIIIIIIIIk..',
    '..kjjjjjjjjjjk..',
    '..kIIIIIIIIJIk..',
    '..kIIIIIIIIJIk..',
    '..kIIIIIIIIIIk..',
    '..kjjjjjjjjjjk..',
    '..kkkkkkkkkkkk..',
  ],
  table: [
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kvvvvvvvvvvvvk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwWwwwwwwWwwk.',
    '.kwwwwwwwWwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kWWWWWWWWWWWWk.',
    '.kqqqqqqqqqqqqk.',
    '.kkkkkkkkkkkkkk.',
    '.kqk........kqk.',
    '.kqk........kqk.',
    '.kkk........kkk.',
    '................',
  ],
  // Fregadero (H5b): encimera con la pila; con agua mientras haya agua corriente.
  sinkWet: [
    'kkkkkkkkkkkkkkkk',
    'kllllllJJllllllk',
    'kllkkkkkkkkkkllk',
    'kllkJaaaaaaJkllk',
    'kllkJaAaaaaJkllk',
    'kllkkkkkkkkkkllk',
    'kLLLLLLLLLLLLLLk',
    'kLdLLLLLLLLLLdLk',
    'kLLLLLLLLLLLLLLk',
    'kddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  // Surtidor de la gasolinera (de adorno), con su manguera.
  pump: [
    '....kkkkkkkk....',
    '....krrrrrrk....',
    '....kRRRRRRk....',
    '....kiIIIIIk....',
    '....kIhhhhIk....',
    '....kIhAAhIk....',
    '....kIhhhhIk....',
    '....kiIIIIIkk...',
    '....kiIIIIIkhk..',
    '....kiIrrIIkhk..',
    '....kiIrrIIkhk..',
    '....kiIIIIIk.hk.',
    '....kiIIIIIk.hk.',
    '....kjjjjjjk.hk.',
    '...kkkkkkkkkkhk.',
    '...kSSSSSSSSk.k.',
    '...kkkkkkkkkk...',
  ],
  // El almacén: palés de madera…
  pallet: [
    '................',
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kvvvvvvvvvvvvk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '.kvvvvvvvvvvvvk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '.kvvvvvvvvvvvvk.',
    '.kwwwwwwwwwwwwk.',
    '.kWWWWWWWWWWWWk.',
    '.kqqkkqqqqkkqqk.',
    '.kkk..kkkk..kkk.',
  ],
  // …y cajas encima mientras haya cosas.
  goods: [
    '....kkkkkkk.....',
    '....kccucck.....',
    '....kCCCCCk.....',
    '....kCCCCCk.....',
    '....kCCCCCk.....',
    '.kkkkkkkkkkkkk..',
    '.kccucckccucck..',
    '.kCCCCCkCCCCCk..',
    '.kCCCCCkCCCCCk..',
    '.kCCCCCkCCCCCk..',
    '.kCCCCCkCCCCCk..',
    '.kkkkkkkkkkkkk..',
    '................',
  ],
  // En un montón: una bolsa (H5b2) o una caja con lo demás, arriba a la derecha.
  bag: [
    '................',
    '........kkkk....',
    '.......kOOOOk...',
    '......kOOQQOOk..',
    '......kOOOOOOk..',
    '......kQOuuOQk..',
    '......kOOOOOOk..',
    '......kQQQQQQk..',
    '.......kkkkkk...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  box: [
    '................',
    '................',
    '........kkkkkk..',
    '........kccuck..',
    '........kCCCCk..',
    '........kCCCCk..',
    '........kCCCCk..',
    '........kkkkkk..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

PROP_SPRITES.sinkDry = PROP_SPRITES.sinkWet!.map((r) => r.replace(/a/g, 'J').replace(/A/g, 'g'));

/** Píxeles sueltos de un dibujo hecho con código (los que tienen forma redonda). */
type Pixels = Map<string, string>;
const key = (x: number, y: number) => `${x},${y}`;

/** Pasa píxeles sueltos (en la casilla, de 0 a 15; y negativa por encima) a filas pegadas abajo. */
function rowsOf(px: Pixels, top: number): string[] {
  const rows: string[] = [];
  for (let y = top; y < 16; y++) {
    let row = '';
    for (let x = 0; x < PROP_W; x++) row += px.get(key(x, y)) ?? '.';
    rows.push(row);
  }
  return rows;
}

/** Un borde oscuro alrededor de lo pintado. */
function outline(px: Pixels, top: number): void {
  const add: [number, number][] = [];
  for (let y = top; y < 16; y++)
    for (let x = 0; x < PROP_W; x++) {
      if (px.has(key(x, y))) continue;
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => px.has(key(x + dx!, y + dy!)) && px.get(key(x + dx!, y + dy!)) !== 'k');
      if (near) add.push([x, y]);
    }
  for (const [x, y] of add) px.set(key(x, y), 'k');
}

/**
 * Un barreño (de madera), una cisterna (de metal) o un barril de lluvia (V2: de madera, más estrecho
 * y alto) visto desde arriba y un poco de frente: el borde, por dentro el agua (que baja según
 * `level`, de 0 a 4) y debajo, la cara con sus duelas y aros.
 */
function vessel(level: number, kind: 'tub' | 'cistern' | 'barrel'): string[] {
  const metal = kind === 'cistern';
  const [cx, cy, rx, ry, depth] =
    kind === 'cistern'
      ? [7.5, 3, 6.5, 3.5, 8]
      : kind === 'barrel'
        ? [7.5, 1, 5, 2.6, 10]
        : [7.5, 7, 6.5, 3.5, 4];
  const [rim, rimDark, inner, stave, line, hoop] = metal
    ? ['g', 'G', 'h', 'G', 'h', 'J']
    : ['v', 'w', 'q', 'w', 'W', 'J'];
  const px: Pixels = new Map();
  const [irx, iry] = [rx - 1.5, ry - 1.2];
  const waterTop = cy - iry + (1 - level / 4) * 2 * iry;
  for (let x = 0; x < PROP_W; x++) {
    const u = (x - cx) / rx;
    if (Math.abs(u) > 1) continue;
    const h = ry * Math.sqrt(1 - u * u);
    for (let y = Math.ceil(cy - h); y <= Math.floor(cy + depth + h); y++) {
      let c: string;
      if (y <= cy + h) {
        const inOpening = ((x - cx) / irx) ** 2 + ((y - cy) / iry) ** 2 <= 1;
        if (!inOpening) c = x < cx && y < cy ? rim : rimDark;
        else if (level > 0 && y >= waterTop) c = y < waterTop + 1 && x < cx ? 'A' : 'a';
        else c = inner;
      } else {
        const fromBottom = Math.floor(cy + depth + h) - y;
        const fromTop = y - Math.floor(cy + h);
        c = fromTop === 1 || fromBottom === 1 ? hoop : x % 3 === 0 ? line : stave;
      }
      px.set(key(x, y), c);
    }
  }
  const top = Math.floor(cy - ry) - 1;
  outline(px, top);
  return rowsOf(px, top);
}

/**
 * La hoguera: un corro de piedras, dos troncos cruzados y la llama, que cambia en cada dibujo; sin
 * leña (V3), sin llama y con ceniza.
 */
function campfire(frame: number, lit = true): string[] {
  const px: Pixels = new Map();
  const [cx, cy] = [7.5, 11];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const [x, y] = [Math.round(cx + Math.cos(a) * 5.5 - 0.5), Math.round(cy + Math.sin(a) * 3)];
    px.set(key(x, y), 's');
    px.set(key(x + 1, y), 'S');
    px.set(key(x, y + 1), 'S');
    px.set(key(x + 1, y + 1), 't');
  }
  for (let x = 4; x <= 11; x++) {
    const y1 = Math.round(12 - ((x - 4) * 2) / 7);
    const y2 = Math.round(10 + ((x - 4) * 2) / 7);
    for (const y of [y1, y2]) {
      px.set(key(x, y), 'W');
      px.set(key(x, y + 1), 'q');
    }
  }
  if (!lit) {
    for (const [x, y] of [
      [6, 11],
      [7, 10],
      [8, 11],
      [9, 10],
    ] as const)
      px.set(key(x, y), 't');
    return rowsOf(px, 0);
  }
  const height = [7, 8, 6][frame % 3]!;
  const sway = [0, 0.7, -0.7][frame % 3]!;
  const base = 11;
  for (let y = base - height; y <= base; y++) {
    const t = (base - y) / height; // 0 abajo, 1 arriba
    const half = 3.2 * (1 - t ** 1.4);
    const mid = cx + sway * t;
    for (let x = 0; x < PROP_W; x++) {
      const d = Math.abs(x - mid);
      if (d > half) continue;
      const c = t > 0.85 ? 'e' : d < half * 0.35 && t < 0.5 ? 'y' : d < half * 0.65 ? 'F' : 'f';
      px.set(key(x, y), c);
    }
  }
  return rowsOf(px, 0);
}

/** De 1 a 3 tablas apiladas (H4a), cada una un poco movida. */
function planks(n: number): string[] {
  const px: Pixels = new Map();
  for (let k = 0; k < n; k++) {
    const y = 11 - k * 3;
    const dx = k % 2;
    for (let x = 3 + dx; x <= 12 + dx; x++) {
      px.set(key(x, y), 'v');
      px.set(key(x, y + 1), 'w');
      px.set(key(x, y + 2), 'q');
    }
  }
  const top = 11 - (n - 1) * 3 - 1;
  outline(px, top);
  return rowsOf(px, top);
}

for (let f = 0; f < 3; f++) PROP_SPRITES[`campfire${f}`] = campfire(f);
PROP_SPRITES.campfireOut = campfire(0, false); // V3
for (let l = 0; l <= 4; l++) {
  PROP_SPRITES[`tub${l}`] = vessel(l, 'tub');
  PROP_SPRITES[`cistern${l}`] = vessel(l, 'cistern');
  PROP_SPRITES[`barrel${l}`] = vessel(l, 'barrel'); // V2
}
for (let n = 1; n <= 3; n++) PROP_SPRITES[`planks${n}`] = planks(n);

/** Un charco de sangre seca bajo un cuerpo (A3), con el borde irregular. */
function bloodPool(): string[] {
  const px: Pixels = new Map();
  for (let y = 5; y < 16; y++)
    for (let x = 0; x < PROP_W; x++) {
      const wobble = 0.85 + 0.3 * ((Math.sin(x * 1.7) + Math.cos(y * 2.3)) / 2);
      const d = ((x - 7.5) / 6.5) ** 2 + ((y - 10) / 3.5) ** 2;
      if (d <= wobble) px.set(key(x, y), d < wobble * 0.5 ? 'Y' : 'V');
    }
  return rowsOf(px, 5);
}
PROP_SPRITES.bloodPool = bloodPool();

/**
 * Salpicaduras de sangre en el suelo (A5): una mancha con gotas alrededor, tres distintas; y una gota
 * suelta, de quien va sangrando.
 */
function splat(seed: number): string[] {
  const px: Pixels = new Map();
  let r = seed;
  const rnd = () => (r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 2 ** 32;
  const [cx, cy] = [7.5 + (rnd() - 0.5) * 2, 10.5 + (rnd() - 0.5) * 2];
  for (let y = 4; y < 16; y++)
    for (let x = 0; x < PROP_W; x++) {
      const d = ((x - cx) / 3.2) ** 2 + ((y - cy) / 2.2) ** 2 + (rnd() - 0.5) * 0.6;
      if (d <= 1) px.set(key(x, y), d < 0.45 ? 'Y' : 'V');
    }
  for (let k = 0; k < 6; k++) {
    const a = rnd() * Math.PI * 2;
    const dist = 4 + rnd() * 3;
    const [x, y] = [Math.round(cx + Math.cos(a) * dist), Math.round(cy + Math.sin(a) * dist * 0.6)];
    if (x >= 0 && x < PROP_W && y >= 4 && y < 16) px.set(key(x, y), 'V');
  }
  return rowsOf(px, 4);
}
for (let k = 0; k < 3; k++) PROP_SPRITES[`splat${k}`] = splat(101 + k * 37);
PROP_SPRITES.drip = [
  '................',
  '................',
  '.......V........',
  '......YV........',
  '.........V......',
];

/**
 * La tierra labrada del huerto (V1): surcos de lado a lado, con el lomo claro y el fondo oscuro;
 * mojada, más oscura.
 */
function soil(wet: boolean): string[] {
  const [top, mid, low] = wet ? ['E', 'H', 'N'] : ['D', 'E', 'H'];
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    const c = y === 0 || y === 15 ? '.' : [top, mid, low][(y - 1) % 3]!;
    rows.push(c === '.' ? '.'.repeat(16) : `.${c.repeat(14)}.`);
  }
  return rows;
}

/** Las seis matas de una parcela, de brote (1) a grandes (3), y con fruto si está madura. */
function crop(stage: 1 | 2 | 3, ripe: boolean): string[] {
  const px: Pixels = new Map();
  const centers: [number, number][] = [
    [3, 4],
    [8, 4],
    [12, 4],
    [3, 11],
    [8, 11],
    [12, 11],
  ];
  const r = [0, 0.7, 1.7, 2.7][stage]!;
  for (const [cx, cy] of centers) {
    for (let y = cy - 3; y <= cy + 1; y++)
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.abs(x - cx) + Math.abs(y - cy) * 1.2;
        if (d > r + 0.2 || x < 0 || x > 15 || y < 0 || y > 15) continue;
        px.set(key(x, y), d < r * 0.4 && y <= cy ? 'K' : d > r - 0.6 ? 'Z' : 'z');
      }
    px.set(key(cx, cy + 1), 'Z'); // el tallo
    if (ripe) {
      px.set(key(cx - 1, cy), 'x');
      px.set(key(cx + 1, cy - 1), 'T');
      px.set(key(cx, cy + 1), 'X');
    }
  }
  return rowsOf(px, 0);
}

PROP_SPRITES.soilDry = soil(false);
PROP_SPRITES.soilWet = soil(true);
PROP_SPRITES.crop1 = crop(1, false);
PROP_SPRITES.crop2 = crop(2, false);
PROP_SPRITES.crop3 = crop(3, false);
PROP_SPRITES.cropRipe = crop(3, true);

/** El dibujo de lo sembrado en una parcela: por tercios de lo que ha crecido, o maduro. */
export function cropFrame(p: Plot): string | null {
  if (!p.crop) return null;
  if (p.crop.grown >= GROW_HOURS) return 'cropRipe';
  return `crop${Math.min(3, 1 + Math.floor((3 * p.crop.grown) / GROW_HOURS))}`;
}

/** Hace un lienzo con todos los dibujos en fila y dice dónde empieza cada uno. */
export function makePropAtlas(): { canvas: HTMLCanvasElement; frames: Record<string, number> } {
  const names = Object.keys(PROP_SPRITES);
  const canvas = document.createElement('canvas');
  canvas.width = PROP_W * names.length;
  canvas.height = PROP_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const frames: Record<string, number> = {};
  names.forEach((name, k) => {
    frames[name] = k * PROP_W;
    const rows = PROP_SPRITES[name]!;
    rows.forEach((row, r) => {
      const y = PROP_H - rows.length + r;
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = PROP_COLORS[ch]!;
        const i = (y * canvas.width + k * PROP_W + x) * 4;
        img.data[i] = c >> 16;
        img.data[i + 1] = (c >> 8) & 255;
        img.data[i + 2] = c & 255;
        img.data[i + 3] = 255;
      });
    });
  });
  ctx.putImageData(img, 0, 0);
  return { canvas, frames };
}

/** Cuánta agua se ve en un barreño o una cisterna: de 0 (vacío) a 4 (lleno). */
export function waterLevel(water: number, max: number): number {
  if (water <= 0) return 0;
  return Math.max(1, Math.min(4, Math.round((water / max) * 4)));
}

/** La llama cambia de dibujo cada `CAMPFIRE_FRAMES` fotogramas. */
const CAMPFIRE_FRAMES = 8;
export const campfireFrame = (frame: number) =>
  `campfire${Math.floor(frame / CAMPFIRE_FRAMES) % 3}`;

/** Lo que se ve de un montón: hasta 3 tablas y, si hay, una bolsa o una caja con lo demás. */
export function pileFrames(items: Inventory): string[] {
  const frames: string[] = [];
  if (items.wood > 0) frames.push(`planks${Math.min(3, items.wood)}`);
  const rest = ITEM_KINDS.some((k) => k !== 'wood' && items[k] > 0) || items.pieces.length > 0;
  if (bagsIn(items.pieces).length > 0) frames.push('bag');
  else if (rest) frames.push('box');
  return frames;
}

/** Cuántas cosas hay en total: cada objeto suelto y cada prenda o bolsa cuentan uno. */
export function itemCount(items: Inventory): number {
  return ITEM_KINDS.reduce((n, k) => n + items[k], 0) + items.pieces.length;
}

/** Cosas que caben en un palé antes de que se vean cajas en el siguiente. */
export const ITEMS_PER_PALLET = 10;

/** En cuántos palés del almacén se ven cajas: uno por cada 10 cosas (o menos), hasta llenarlos. */
export function stockedPallets(count: number, pallets: number): number {
  return Math.min(pallets, Math.ceil(count / ITEMS_PER_PALLET));
}
