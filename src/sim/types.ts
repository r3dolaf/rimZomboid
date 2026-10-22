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
  WoodWall: 7,
  BoardedWindow: 8,
  // Lo que dejan los zombis al romper (H4b): se pisa y no tapa la vista.
  BrokenWindow: 9,
  BrokenDoor: 10,
  Rubble: 11,
  // H4d: ventana con las cortinas corridas (tapa la vista) y puerta de casa atrancada.
  CurtainedWindow: 12,
  LockedDoor: 13,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Cuadrícula fila a fila: la casilla (x, y) está en tiles[y * width + x]. */
export interface Grid {
  width: number;
  height: number;
  tiles: Tile[];
  /** Sube con cada cambio de casilla: la interfaz redibuja el mapa cuando cambia. */
  version: number;
}

/** Un edificio: `rect` incluye los muros; `door` es la casilla de la puerta, en el muro. */
export interface Building {
  id: number;
  rect: Rect;
  door: Point;
}

/** Qué cerebro decide por un superviviente. En la fase 2 se añadirá 'player'. */
export type BrainId = 'ai';

export type TraitId =
  | 'brave'
  | 'coward'
  | 'glutton'
  | 'sleepyhead'
  | 'optimist'
  | 'pessimist'
  // Habilidades (H4c)
  | 'handy'
  | 'clumsy'
  | 'strong'
  | 'weak'
  | 'fastLearner'
  | 'slowLearner'
  | 'pleasant'
  | 'unpleasant'
  | 'keenEye';

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
  | 'storm'
  // Muebles (H4a)
  | 'ateAtTable'
  | 'byTheFire'
  // Zombis (H4b)
  | 'downed'
  // Habilidades (H4c): tras un consuelo que no funciona, 1 h sin que nadie lo intente (no pesa).
  | 'notConsoled';

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
  | { type: 'console'; otherId: number }
  // Talar (H4a): coger o devolver el hacha en el almacén y talar el árbol de la casilla `tree`.
  | { type: 'takeAxe' }
  | { type: 'storeAxe' }
  | { type: 'chop'; tree: number }
  // Transportar (H4a): recoger un montón, coger madera para un plano y entregarla.
  | { type: 'pickUp'; pileId: number }
  | { type: 'fetchWood'; blueprintId: number }
  | { type: 'deliver'; blueprintId: number }
  // Construir (H4a): trabajar en un plano con toda su madera.
  | { type: 'build'; blueprintId: number }
  // Armas (H4b): en el almacén, cambiar lo que lleva en la mano por lo mejor que haya.
  | { type: 'swapWeapon' }
  // Puertas atrancadas (H4d): coger la palanca del almacén y forzar la puerta de la casilla `door`.
  | { type: 'takeCrowbar' }
  | { type: 'pry'; door: number };

export type Action =
  /** `wait`: esperando tras no encontrar camino (no se consulta al cerebro) o tras negarse a trabajar. */
  | { type: 'idle'; ticksLeft: number; wait?: 'noPath' | 'refused' }
  /** `run`: va corriendo (huye o va a por un zombi): más rápido, pero hace ruido. */
  | { type: 'moveTo'; target: Point; then?: Activity; run?: boolean }
  /** `fromPack`: se come una lata de las que lleva encima, sin ir al almacén. */
  | { type: 'eat'; ticksLeft: number; fromPack?: boolean }
  | { type: 'sleep'; inBed: boolean }
  | { type: 'crisis'; ticksLeft: number }
  | { type: 'search'; containerId: number; ticksLeft: number }
  | { type: 'unload'; ticksLeft: number }
  | { type: 'fight'; otherId: number; ticksLeft: number }
  /** Consuela a `otherId`, que mientras tanto está en `consoled` (lo lleva el que consuela). */
  | { type: 'console'; otherId: number; ticksLeft: number }
  /** `crisisLeft`: lo que le quedaba de crisis, para seguir con ella si el consuelo sale mal (H4c). */
  | { type: 'consoled'; otherId: number; crisisLeft?: number }
  | { type: 'chop'; tree: number; ticksLeft: number }
  /** El avance se guarda en el plano (si se deja a medias, no se pierde). */
  | { type: 'build'; blueprintId: number }
  // Zombis (H4b): en el suelo hasta `until`; peleando con un zombi.
  | { type: 'downed'; until: number }
  | { type: 'melee'; zombieId: number; cooldown: number }
  // Forzando una puerta atrancada (H4d).
  | { type: 'pry'; door: number; ticksLeft: number };

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
  /** Habilidades (H4c). */
  skills: Record<SkillId, Skill>;
  memories: Memory[];
  /** Su cama, o `null` si no hay sitio (duerme en el suelo de la base). */
  bedId: number | null;
  /** Lo que lleva encima (como mucho su capacidad, según Transportar: `capacityKg`). */
  carrying: Inventory;
  /** Trabajos permitidos (casillas del panel de Trabajos). */
  work: Record<WorkType, boolean>;
  /** Prioridad de cada trabajo, de 1 (lo primero) a 4 (H4d). */
  priorities: Record<WorkType, number>;
  /** Lo que lleva en la mano (no cuenta como carga): herramienta y arma. */
  equipped: Weapon | null;
  /** No cambia ni devuelve lo que lleva en la mano. */
  weaponLocked: boolean;
  /** Salud de 0 (derribado) a 100. */
  health: number;
  /** Qué hace cuando ve zombis. */
  stance: Stance;
  /** Opinión sobre cada uno de los demás, por id, de −100 a 100 (sin entrada, 0). */
  opinions: Record<string, number>;
  partnerId: number | null;
  /** Tick en que intentará charlar con alguien. */
  nextChatAt: number;
  bubble: { kind: BubbleKind; until: number } | null;
  /** Con gripe hasta `until`; `plan`, lo que decidió el jugador (descansar: sin saquear). */
  sick: { until: number; plan: 'undecided' | 'rest' | 'work' } | null;
  /** Ya ha tenido su cumpleaños. */
  celebrated: boolean;
}

/** Uno o dos desconocidos que esperan a la puerta a que el jugador decida (su decisión caduca). */
export interface Stranger {
  survivors: Survivor[];
  /** Ya se van hacia el borde del mapa. */
  leaving: boolean;
}

/** Armas que se llevan en la mano, de mejor a peor (spec H4b §6.2). */
export type Weapon = 'machete' | 'crowbar' | 'axe' | 'bat' | 'knife';

/** Pelear, Huir o Decidir (spec H4b §7). */
export type Stance = 'fight' | 'flee' | 'decide';

/** Opción Zombis de la portada. */
export type ZombieLevel = 'few' | 'normal' | 'many';

/** Un zombi (spec H4b §2.1). */
export interface Zombie {
  id: number;
  pos: Point;
  path: Point[];
  health: number;
  state: 'wander' | 'alert' | 'chase';
  /** El colono que persigue. */
  targetId: number | null;
  /** Adonde va (un ruido, una hoguera, donde vio a alguien, un paseo). */
  goal: Point | null;
  /** Último tick en que algo le llamó la atención (vio a quien persigue, oyó un ruido…). */
  lastSeenAt: number;
  /** Ticks hasta su próximo golpe. */
  cooldown: number;
  /** Al vagar, espera hasta este tick antes del siguiente paseo. */
  waitUntil: number;
}

/** Trabajos, en orden de criticidad (spec H4a §3.1). */
export type WorkType = 'social' | 'build' | 'craft' | 'haul' | 'chop' | 'loot';

/** Habilidades (H4c): una por trabajo y Pelear. */
export type SkillId = WorkType | 'fight';

/** Nivel de 0 a 10 y la práctica acumulada hacia el siguiente. */
export interface Skill {
  level: number;
  xp: number;
}

export interface Bed {
  id: number;
  pos: Point;
  /** `null`: cama construida que aún no es de nadie. */
  ownerId: number | null;
}

/** Objetos tirados en una casilla transitable. */
export interface Pile {
  id: number;
  pos: Point;
  items: Inventory;
}

export type BuildKind =
  | 'bed'
  | 'table'
  | 'campfire'
  | 'woodWall'
  | 'woodDoor'
  | 'board'
  | 'unboard'
  // Reparar (H4b): devolver la resistencia a lo dañado y rehacer una puerta rota.
  | 'repair'
  | 'fixDoor'
  // Cortinas (H4d): correrlas o abrirlas, descolgarlas y colgar unas.
  | 'curtains'
  | 'takeDownCurtains'
  | 'hangCurtains'
  // Romper una ventana a propósito (H4d).
  | 'smashWindow';

/** Algo por construir: madera (y cortinas, H4d) entregadas y ticks trabajados. */
export interface Blueprint {
  id: number;
  kind: BuildKind;
  pos: Point;
  wood: number;
  progress: number;
  /** Cortinas entregadas (solo para colgarlas; si falta, 0). */
  curtains?: number;
}

export interface Furniture {
  id: number;
  kind: 'table' | 'campfire';
  pos: Point;
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
  piles: Pile[];
  blueprints: Blueprint[];
  furniture: Furniture[];
  /** Árboles marcados para talar, por índice y·ancho + x. */
  chopMarks: number[];
  /** Cuentas de la madera, para comprobar que nunca aparece ni desaparece. */
  /** `wasted`: la que se pierde al fallar al construir (H4c). */
  woodLog: { start: number; chopped: number; recovered: number; spent: number; wasted: number };
  // Zombis (H4b)
  zombies: Zombie[];
  /** Su propio azar: añadir zombis no cambia lo que hacen los colonos con la misma semilla. */
  zombieRng: RngState;
  zombieLevel: ZombieLevel;
  nextZombieId: number;
  /** Tick de la siguiente llegada por los bordes. */
  nextZombieAt: number;
  /** Resistencia que le queda a cada casilla dañada, por índice y·ancho + x (lo intacto no está). */
  damage: Record<string, number>;
  /** Día en que se avisó del primer zombi visto cerca de la base (uno al día). */
  zombieSightedDay: number;
  // Tela, cortinas y cuerpos (H4d)
  /** Ventanas con cortinas (corridas o no, también tapiadas), por índice y·ancho + x. */
  curtains: number[];
  /** Pedidos de Fabricar, de arriba abajo. */
  bills: Bill[];
  nextBillId: number;
  /** Armas que salen de los cuerpos y que se pudren con ellos (para que las cuentas cuadren). */
  weaponLog: { fromCorpses: number; rotted: number };
}

/** Recetas de Fabricar (H4d). */
export type RecipeId = 'bandages' | 'curtains' | 'unpick';

/** Un pedido: `count`, hacer N veces (`done` lleva la cuenta); `until`, hasta tener N en el almacén. */
export interface Bill {
  id: number;
  recipe: RecipeId;
  mode: 'count' | 'until';
  target: number;
  done: number;
}
