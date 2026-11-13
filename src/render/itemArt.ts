// V4 §6: los dibujos de lo cosechado, las semillas y los platos (para los paneles) y la olla en la
// hoguera mientras se cocina (para el mapa). Filas de 16 letras (PROP_COLORS; `.`, nada).
import type { ItemKind } from '../sim/items';

const W = 16;
type Grid = string[][];
const grid = (h = 16): Grid => Array.from({ length: h }, () => Array<string>(W).fill('.'));
const put = (g: Grid, x: number, y: number, c: string) => {
  if (x >= 0 && x < W && y >= 0 && y < g.length) g[y]![x] = c;
};
const rows = (g: Grid): string[] => g.map((r) => r.join(''));

/** Un borde oscuro alrededor de lo dibujado (para que se lea en pequeño sobre cualquier fondo). */
function outline(g: Grid): void {
  const was = g.map((r) => r.slice());
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < W; x++) {
      if (was[y]![x] !== '.') continue;
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const c = was[y + dy!]?.[x + dx!];
        return c !== undefined && c !== '.';
      });
      if (near) g[y]![x] = 'k';
    }
}

/** Una elipse de `r` (radios) en `c`, pintada según `paint` (con la distancia normalizada). */
function blob(
  r: readonly [number, number],
  c: readonly [number, number],
  paint: (x: number, y: number, d: number) => string,
): Grid {
  const g = grid();
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1]);
      if (d <= 1) put(g, x, y, paint(x, y, d));
    }
  outline(g);
  return g;
}

const lettuce = () =>
  rows(
    blob([5.2, 4.6], [7.5, 9], (x, y, d) =>
      d < 0.4 ? '1' : d < 0.75 ? ((x + y) % 3 === 0 ? '3' : '2') : '3',
    ),
  );
const cabbage = () =>
  rows(
    blob([5.4, 5], [7.5, 9], (x, y, d) =>
      d < 0.45
        ? d < 0.25
          ? '4'
          : '5'
        : Math.abs(x - 7.5) < 0.6 || Math.abs(y - 9) < 0.6
          ? '5'
          : d > 0.8
            ? '7'
            : '6',
    ),
  );
const potato = () =>
  rows(
    blob([5.4, 3.6], [7.5, 10], (x, y, d) =>
      (x === 5 && y === 9) || (x === 9 && y === 11) ? '0' : x + y > 19 && d > 0.55 ? '0' : '9',
    ),
  );
function tomato(): string[] {
  const g = blob([4.8, 4.4], [7.5, 10], (x, y, d) =>
    x < 7 && y < 9 && d < 0.6 ? 'p' : x + y > 18 && d > 0.6 ? '*' : '+',
  );
  for (const [x, y] of [
    [6, 5],
    [7, 5],
    [8, 5],
    [9, 5],
    [7, 4],
    [8, 6],
  ] as const)
    put(g, x, y, 'Z');
  return rows(g);
}

/** Un sobre de semillas (de papel) con una franja del color de su cultivo y su dibujo pequeño. */
function packet(band: string, dot: string): string[] {
  const g = grid();
  for (let y = 2; y <= 14; y++)
    for (let x = 3; x <= 12; x++) put(g, x, y, y <= 3 ? 'C' : x >= 11 ? 'P' : 'p');
  for (let y = 9; y <= 11; y++) for (let x = 3; x <= 12; x++) put(g, x, y, band);
  for (const [x, y] of [
    [7, 6],
    [8, 6],
    [7, 5],
    [8, 7],
  ] as const)
    put(g, x, y, dot);
  outline(g);
  return rows(g);
}

/** Un cuenco de madera visto un poco desde arriba, con lo que lleva (y su vapor si es caliente). */
function bowl(
  base: string,
  shade: string,
  bits: readonly (readonly [number, number, string])[],
  steam = true,
  heap = false,
): string[] {
  const g = grid();
  const cx = 7.5;
  for (let y = 8; y <= 13; y++) {
    const half = 6 - ((y - 8) / 5) * 2.6;
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      if (Math.abs(dx) > half) continue;
      put(g, x, y, y === 13 ? 'q' : dx < -half + 1.5 ? 'v' : dx > half - 1.6 ? 'W' : 'w');
    }
  }
  for (let y = heap ? 4 : 6; y <= 9; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - cx) / 5.2, (y - 8) / (heap ? 3.6 : 1.5));
      if (d <= 1 && (y <= 8 || d <= 0.9))
        put(g, x, y, y > 8 ? shade : d > 0.8 && x > cx ? shade : base);
    }
  for (const [x, y, c] of bits) put(g, x, y, c);
  if (steam)
    for (const [x, y] of [
      [6, 4],
      [7, 3],
      [6, 2],
      [9, 5],
      [10, 4],
      [9, 3],
    ] as const)
      put(g, x, y, 'P');
  outline(g);
  return rows(g);
}

/** Un tarro de cristal con la conserva, la tapa y la etiqueta. */
function jar(): string[] {
  const g = grid();
  for (let y = 5; y <= 14; y++)
    for (let x = 4; x <= 11; x++) {
      if (y === 14 && (x === 4 || x === 11)) continue;
      let c = x >= 10 ? '*' : '+';
      if (y === 5) c = 'A';
      if (y >= 9 && y <= 10) c = x >= 10 ? 'C' : 'c';
      if (x === 5 && y >= 6 && y <= 12 && y % 2 === 0 && !(y >= 9 && y <= 10)) c = 'i';
      put(g, x, y, c);
    }
  for (let x = 4; x <= 11; x++) {
    put(g, x, 3, 'g');
    put(g, x, 4, x >= 10 ? 'h' : 'G');
  }
  outline(g);
  return rows(g);
}

/** El dibujo de cada objeto nuevo de V4 (para los iconos de los paneles). */
export const ITEM_SPRITES: Partial<Record<ItemKind, readonly string[]>> = {
  lettuce: lettuce(),
  tomato: tomato(),
  potato: potato(),
  cabbage: cabbage(),
  seedsLettuce: packet('2', '3'),
  seedsTomato: packet('+', 'Z'),
  seedsPotato: packet('9', '0'),
  seedsCabbage: packet('6', '4'),
  stewVeg: bowl('T', 'e', [
    [5, 7, '2'],
    [8, 8, '2'],
    [10, 7, 'u'],
    [6, 8, 'u'],
    [9, 7, '3'],
  ]),
  stewPotato: bowl('c', 'C', [
    [5, 7, '9'],
    [6, 7, '9'],
    [9, 8, '9'],
    [10, 8, '9'],
    [8, 7, 'p'],
    [11, 7, '3'],
  ]),
  soupCabbage: bowl('5', '6', [
    [4, 7, '7'],
    [5, 8, '7'],
    [8, 7, '4'],
    [10, 8, '7'],
    [11, 7, '4'],
  ]),
  salad: bowl(
    '2',
    '3',
    [
      [5, 5, '1'],
      [8, 4, '1'],
      [10, 6, '1'],
      [6, 7, '+'],
      [9, 6, '+'],
      [7, 5, '+'],
      [11, 7, '3'],
      [4, 7, '3'],
    ],
    false,
    true,
  ),
  preserves: jar(),
};

/** Los platos que se hacen en olla y el color de lo que hierve (claro y oscuro). */
export const POT_COLORS: Readonly<Record<string, readonly [string, string]>> = {
  stewVeg: ['T', 'e'],
  stewPotato: ['c', 'C'],
  soupCabbage: ['5', '6'],
  preserves: ['+', '*'],
};

/**
 * La hoguera con una olla encima (20 filas: sale por arriba de su casilla), con lo que hierve y su
 * vapor; la llama cambia con `frame` (0–2), como la de la hoguera.
 */
export function potSprite(base: string, shade: string, frame: number): string[] {
  const g = grid(20);
  for (const [x, y] of [
    [2, 18],
    [4, 19],
    [7, 19],
    [10, 19],
    [13, 18],
  ] as const) {
    put(g, x, y, 's');
    put(g, x + 1, y, 'S');
  }
  const flame = [
    [4, 11, 17],
    [5, 10, 16],
    [4, 11, 16],
  ][frame % 3]!;
  for (let x = flame[0]!; x <= flame[1]!; x++) put(g, x, 17, x % 3 === frame % 3 ? 'F' : 'f');
  for (let x = flame[0]! + 1; x <= flame[1]! - 1; x += 2) put(g, x, flame[2]!, 'f');
  for (let y = 9; y <= 15; y++) {
    const half = y === 15 ? 4.5 : 5.5;
    for (let x = 0; x < W; x++) {
      const dx = x - 7.5;
      if (Math.abs(dx) > half) continue;
      put(g, x, y, dx > half - 1.6 ? 'h' : dx < -half + 1.2 ? 'g' : 'G');
    }
  }
  for (let x = 2; x <= 13; x++) put(g, x, 8, 'g');
  for (const y of [8, 9, 10])
    for (let x = 3; x <= 12; x++)
      if (!(y === 8 && (x === 3 || x === 12))) put(g, x, y, x > 9 ? shade : base);
  put(g, 1, 10, 'h');
  put(g, 14, 10, 'h');
  const rise = frame % 2;
  for (const [x, y] of [
    [6, 6],
    [7, 5],
    [6, 4],
    [9, 6],
    [10, 5],
    [9, 4],
  ] as const)
    put(g, x, y - rise, 'P');
  outline(g);
  return rows(g);
}
