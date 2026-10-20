// Tipos de datos de la simulación. Solo datos simples, para poder guardarlos con JSON.
import type { Inventory } from './items';
import type { LogEntry } from './log';
import type { Order } from './orders';
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
  /** Ganas de compañía: baja con el tiempo y sube al charlar. */
  social: number;
}

export type MemoryId =
  | 'sleptInBed'
  | 'sleptOnFloor'
  | 'ate'
  | 'vented'
  | 'goodChat'
  | 'argued'
  | 'insulted'
  | 'fought'
  | 'consoled'
  | 'consoledByPartner'
  | 'sharedFood'
  | 'breakup'
  | 'sleptWithPartner'
  // Narrador (H3c)
  | 'punished'
  | 'punishedUnfairly'
  | 'thiefAmongUs'
  | 'jealous'
  | 'clash'
  | 'grief'
  | 'foodFight'
  | 'storyNight'
  | 'happyBirthday'
  | 'party'
  | 'ruinedBirthday'
  | 'forgottenBirthday'
  | 'storm';

/** Recuerdo con efecto en el ánimo hasta el tick `expiresAt`; `otherId`, con quién fue. */
export interface Memory {
  id: MemoryId;
  expiresAt: number;
  otherId?: number;
}

/** Icono sobre la cabeza: charla, discusión o insulto, pelea, consuelo, compartir y pareja. */
export type BubbleKind = 'chat' | 'argue' | 'fight' | 'console' | 'share' | 'love';

/** Lo que se hace al llegar al destino de un `moveTo`. */
export type Activity =
  | { type: 'eat' }
  | { type: 'sleep' }
  | { type: 'crisis' }
  | { type: 'search'; containerId: number }
  | { type: 'unload' }
  | { type: 'console'; otherId: number };

export type Action =
  /** `wait`: esperando tras no encontrar camino (no se consulta al cerebro) o tras negarse a trabajar. */
  | { type: 'idle'; ticksLeft: number; wait?: 'noPath' | 'refused' }
  | { type: 'moveTo'; target: Point; then?: Activity }
  /** `fromPack`: se come una lata de las que lleva encima, sin ir al almacén. */
  | { type: 'eat'; ticksLeft: number; fromPack?: boolean }
  | { type: 'sleep'; inBed: boolean }
  | { type: 'crisis'; ticksLeft: number }
  | { type: 'search'; containerId: number; ticksLeft: number }
  | { type: 'unload'; ticksLeft: number }
  | { type: 'fight'; otherId: number; ticksLeft: number }
  /** Consuela a `otherId`, que mientras tanto está en `consoled` (lo lleva el que consuela). */
  | { type: 'console'; otherId: number; ticksLeft: number }
  | { type: 'consoled'; otherId: number };

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
  /** Su cama, o `null` si no hay sitio (duerme en el suelo de la base). */
  bedId: number | null;
  /** Lo que lleva encima (como máximo CARRY_CAPACITY_KG). */
  carrying: Inventory;
  /** Trabajos permitidos (prioridades del jugador). */
  work: { loot: boolean };
  /** Opinión sobre cada uno de los demás, por id, de −100 a 100 (sin entrada, 0). */
  opinions: Record<string, number>;
  partnerId: number | null;
  /** Tick en que intentará charlar con alguien. */
  nextChatAt: number;
  bubble: { kind: BubbleKind; until: number } | null;
  /** Con gripe hasta `until`; `resting`, sin trabajar mientras tanto. */
  sick: { until: number; resting: boolean } | null;
  /** Ya ha tenido su cumpleaños. */
  celebrated: boolean;
}

/** Uno o dos desconocidos que esperan a la puerta a que el jugador decida (su decisión caduca). */
export interface Stranger {
  survivors: Survivor[];
  /** Ya se van hacia el borde del mapa. */
  leaving: boolean;
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

export type ContainerKind = 'fridge' | 'wardrobe' | 'shelf';

/** Mueble de una casa con objetos. Transitable: se registra de pie sobre él. */
export interface Container {
  id: number;
  houseId: number;
  pos: Point;
  kind: ContainerKind;
  items: Inventory;
  /** Alguien ya lo ha registrado (se sabe lo que queda). */
  searched: boolean;
  /** Marcado para saquear. */
  designated: boolean;
  /** Superviviente que va a registrarlo, para que no vayan dos. */
  reservedBy: number | null;
}

export type NarratorStyle = 'calm' | 'balanced' | 'chaotic';
export type Tone = 'good' | 'mixed' | 'bad';
export type EventId =
  | 'theft'
  | 'jealousy'
  | 'clash'
  | 'grief'
  | 'foodFight'
  | 'gossip'
  | 'storyNight'
  | 'birthday'
  | 'cache'
  | 'strangers'
  | 'storm'
  | 'flu';

/** El narrador (spec H3c §2): cuándo y de qué tono pasan cosas. */
export interface Narrator {
  style: NarratorStyle;
  /** Solo la usa el Equilibrado. */
  phase: 'calm' | 'tension';
  phaseEndsAt: number;
  nextEventAt: number;
  /** Tick en que salió cada suceso por última vez. */
  lastAt: Partial<Record<EventId, number>>;
}

/** Algo que el jugador tiene que decidir; si no contesta antes de `expiresAt`, se aplica la opción por defecto. */
export interface Decision {
  id: number;
  kind: 'theft' | 'birthday' | 'flu' | 'stranger';
  survivorIds: number[];
  expiresAt: number;
  /** Robo: si el sospechoso es el culpable de verdad. */
  guilty?: boolean;
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
  containers: Container[];
  /** 1 si la casilla se ha visto alguna vez (niebla de guerra), por índice y·ancho + x. */
  seen: number[];
  /** Órdenes del jugador pendientes de aplicar en el siguiente tick. */
  orders: Order[];
  /** Registro de sucesos (los últimos LOG_MAX). */
  log: LogEntry[];
  nextId: number;
  stranger: Stranger | null;
  narrator: Narrator;
  decisions: Decision[];
  /** Hay tormenta mientras el tick sea menor que este. */
  stormUntil: number;
}
