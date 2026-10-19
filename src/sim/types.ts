// Tipos de datos de la simulación. Solo datos simples, para poder guardarlos con JSON.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const Tile = {
  Grass: 0,
  Floor: 1,
  Road: 2,
  Wall: 3,
  Door: 4,
  Window: 5,
  Tree: 6,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Cuadrícula fila a fila: la casilla (x, y) está en tiles[y * width + x]. */
export interface Grid {
  width: number;
  height: number;
  tiles: Tile[];
}

/** Un edificio: `rect` incluye los muros; `door` es la casilla de la puerta, en el muro. */
export interface Building {
  id: number;
  rect: Rect;
  door: Point;
}
