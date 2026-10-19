// Tipos de datos de la simulación. Solo datos simples, para poder guardarlos con JSON.
import type { Inventory } from './items';
import type { RngState } from './rng';

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

/** Qué cerebro decide por un superviviente. En la fase 2 se añadirá 'player'. */
export type BrainId = 'ai';

export type TraitId = 'brave' | 'coward' | 'glutton' | 'sleepyhead' | 'optimist' | 'pessimist';

/** Necesidades de 0 a 100 (100 = bien). */
export interface Needs {
  hunger: number;
  sleep: number;
  mood: number;
}

export type MemoryId = 'sleptInBed' | 'sleptOnFloor' | 'ate' | 'vented';

/** Recuerdo con efecto en el ánimo hasta el tick `expiresAt`. */
export interface Memory {
  id: MemoryId;
  expiresAt: number;
}

/** Lo que se hace al llegar al destino de un `moveTo`. */
export type Activity = { type: 'eat' } | { type: 'sleep' } | { type: 'crisis' };

export type Action =
  /** `wait`: esperando tras no encontrar camino (no se consulta al cerebro) o tras negarse a trabajar. */
  | { type: 'idle'; ticksLeft: number; wait?: 'noPath' | 'refused' }
  | { type: 'moveTo'; target: Point; then?: Activity }
  | { type: 'eat'; ticksLeft: number }
  | { type: 'sleep'; inBed: boolean }
  | { type: 'crisis'; ticksLeft: number };

export interface Survivor {
  id: number;
  name: string;
  /** Posición continua: el centro de la casilla (i, j) es (i + 0.5, j + 0.5). */
  pos: Point;
  brain: BrainId;
  action: Action;
  /** Casillas que le quedan por recorrer, la siguiente primero. */
  path: Point[];
  needs: Needs;
  traits: TraitId[];
  memories: Memory[];
  bedId: number;
  /** Lo que lleva encima (como máximo CARRY_CAPACITY_KG). */
  carrying: Inventory;
}

export interface Bed {
  id: number;
  pos: Point;
  ownerId: number;
}

/** Almacén de la base. */
export interface Storage {
  tiles: Point[];
  items: Inventory;
}

export interface World {
  seed: number;
  tick: number;
  rng: RngState;
  grid: Grid;
  base: Building;
  houses: Building[];
  survivors: Survivor[];
  beds: Bed[];
  storage: Storage;
  nextId: number;
}
