// Tipos de datos de la simulación. Solo datos simples, para poder guardarlos con JSON.
import type { Inventory, ItemKind } from './items';
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
/** Tipos de edificio (H4f); la base es `base`. */
export type BuildingKind =
  | 'base'
  | 'house'
  | 'supermarket'
  | 'pharmacy'
  | 'hardware'
  | 'police'
  | 'clothes'
  | 'gas'
  | 'farm'
  | 'warehouse';

/** Los que se saquean (todos menos la base). */
export type LootKind = Exclude<BuildingKind, 'base'>;

export interface Building {
  id: number;
  kind: BuildingKind;
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
  | 'keenEye'
  // Estilo (H5b §5)
  | 'vain'
  | 'slob'
  | 'practical';

/** Partes del cuerpo (H5 §2.1). */
export type BodyPart = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
export type WoundKind = 'scratch' | 'cut' | 'bite';

/** Prendas (H5b §2). */
export type GarmentKind =
  | 'tshirt'
  | 'longSleeve'
  | 'shirt'
  | 'hoodie'
  | 'sweater'
  | 'denimJacket'
  | 'leatherJacket'
  | 'coat'
  | 'vest'
  | 'tracksuit'
  | 'jeans'
  | 'workPants'
  | 'chaps'
  | 'cap'
  | 'beanie'
  | 'helmet';
/** Capas, de dentro a fuera; lo de la cabeza es de fuera (así dos de cabeza siempre chocan). */
export type Layer = 'inner' | 'middle' | 'outer';
/** Material de un parche o un refuerzo (el montón del mismo nombre). */
export type Material = 'cloth' | 'denim' | 'leather';

/**
 * Una prenda (H5b §2): agujeros, parches y refuerzos por zona; horas puesta desde que se lavó; si
 * tiene sangre; si es de un muerto (de una persona o de un zombi).
 */
export interface Garment {
  id: number;
  kind: GarmentKind;
  holes: BodyPart[];
  patches: Partial<Record<BodyPart, Material>>;
  pads: Partial<Record<BodyPart, Material>>;
  dirtHours: number;
  bloody: boolean;
  from: 'colonist' | 'zombie' | null;
}

/** Mochilas y bolsas (H5b2 §1). */
export type BagKind = 'fannyPack' | 'clothBag' | 'schoolBag' | 'duffel' | 'hikingPack';
/** Dónde se lleva una bolsa: cintura, espalda o mano. */
export type BagSlot = 'waist' | 'back' | 'hand';

/**
 * Una bolsa (H5b2 §1, §3): lo que lleva dentro (montones y prendas, nunca otras bolsas) y su lista,
 * qué cosas y cuántas guarda (lo que no se descarga y se rellena).
 */
export interface Bag {
  id: number;
  kind: BagKind;
  items: Inventory;
  list: Partial<Record<ItemKind, number>>;
}

/** Lo que se guarda suelto, con su estado (H5b §1): prendas y bolsas (H5b2). */
export type Piece = Garment | Bag;

/** Una herida (H5 §2.2): `damage` baja al curarse (de `size` a 0); `cleanUntil`, venda limpia. */
export interface Wound {
  id: number;
  part: BodyPart;
  kind: WoundKind;
  size: number;
  damage: number;
  /** Tick en que se hizo (lo reciente que es: cuánto duele). */
  at: number;
  bleeding: boolean;
  /** Con venda limpia hasta este tick (0: sin vendar). */
  cleanUntil: number;
}

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
  // La muerte (H5 §8): de alguien de la colonia y de su pareja.
  | 'died'
  | 'partnerDied'
  // Que se vaya y acabar con su sufrimiento (H5 §7.4).
  | 'banished'
  | 'partnerBanished'
  | 'sawTurned'
  | 'hadToKill'
  | 'killedForNothing'
  // Habilidades (H4c): tras un consuelo que no funciona, 1 h sin que nadie lo intente (no pesa).
  | 'notConsoled';

/**
 * Recuerdo con efecto en el ánimo hasta el tick `expiresAt`; `otherId`, con quién fue; `value`, si
 * no es el de siempre (H5: una muerte pesa según lo que se pensaba del muerto).
 */
export interface Memory {
  id: MemoryId;
  expiresAt: number;
  otherId?: number;
  value?: number;
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
  | { type: 'pry'; door: number }
  // Fabricar (H4d): coger del almacén los materiales del pedido y trabajarlos en la mesa `tableId`.
  | { type: 'fetchCraft'; billId: number }
  /** Con `pieceId`, sobre esa prenda (H5b), y con `material`, el que se llevó. */
  | { type: 'craft'; billId: number; tableId: number; pieceId?: number; material?: Material }
  // Sanar (H4e): coger al derribado y dejarlo en su sitio.
  | { type: 'rescue'; downedId: number }
  | { type: 'dropOff'; downedId: number }
  | { type: 'bandage'; patientId: number }
  | { type: 'mercy'; patientId: number }
  // Vendas (H5): coger del almacén hasta llevar las que tocan.
  | { type: 'takeBandages' }
  // Rellenar (H5b2 §3): lo que le falta, y llenar una bolsa guardada (Transportar).
  | { type: 'takeSupplies' }
  | { type: 'packBag'; pieceId: number }
  // Bolsas (H5b2 §2): en el almacén, ponerse la mejor que permita su atuendo.
  | { type: 'bags' }
  // Expediciones (H5c1): prepararse en el almacén y salir del mapa por el borde.
  | { type: 'prepareTrip' }
  | { type: 'leaveMap' }
  // Recoger su bolsa del montón donde la soltó (H5b2 §5).
  | { type: 'pickUpBag'; pileId: number }
  // Descansar (en la cama a la que va) y analgésicos (tomárselo; ir a por uno y llevárselo a otro).
  | { type: 'rest' }
  | { type: 'takePainkiller' }
  | { type: 'fetchPainkiller'; patientId: number }
  | { type: 'givePainkiller'; patientId: number }
  // Vestirse (H5b §4): en el almacén, ponerse lo mejor y quitarse lo que no toca.
  | { type: 'dress' }
  // Llenar el barreño (H5b §6): coger agua o un cubo en el almacén, llenarlo en una fuente y vaciarlo.
  | { type: 'takeWater'; tubId: number }
  | { type: 'fillBucket'; sourceId: number; tubId: number }
  | { type: 'pourWater'; tubId: number };

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
  /** `inBed`: lo han dejado en una cama (H4e); `carriedBy`: quién lo lleva en brazos. */
  | { type: 'downed'; until: number; inBed?: boolean; carriedBy?: number }
  /** `hold` (modo combate, H4e): golpea sin moverse; si el zombi se aleja, no lo persigue. */
  | { type: 'melee'; zombieId: number; cooldown: number; hold?: boolean }
  // Forzando una puerta atrancada (H4d).
  | { type: 'pry'; door: number; ticksLeft: number }
  // Fabricando en una mesa (H4d): `recipe` por si el pedido se quita a medias.
  | {
      type: 'craft';
      billId: number;
      tableId: number;
      recipe: RecipeId;
      ticksLeft: number;
      pieceId?: number;
      material?: Material;
    }
  // Vendando a `patientId` (Sanar, H4e).
  | { type: 'bandage'; patientId: number; woundId: number; ticksLeft: number }
  | { type: 'mercy'; patientId: number; ticksLeft: number }
  // Descansando por dolor (y, en H5 §7, por fiebre): acostado sin trabajar.
  | { type: 'rest' }
  // Vistiéndose (H5b §4).
  | { type: 'dress'; ticksLeft: number };

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
  /** Fiebre (H5 §7): de gripe o de infección, que se ven igual; sustituye a la gripe de H3c. */
  fever: Fever | null;
  /** Ya ha tenido su cumpleaños. */
  celebrated: boolean;
  /** En modo combate (H4e): solo obedece al jugador. */
  drafted: boolean;
  /** El derribado que lleva en brazos (Sanar, H4e), o `null`. */
  carryingId: number | null;
  /** Heridas (H5). La Salud (`health`) es 100 menos lo que duelen. */
  wounds: Wound[];
  /** Sangre, de 0 a 100 (H5 §3). */
  blood: number;
  /** De qué va a morir en este tick (lo apuntan la sangre y las heridas; lo resuelve la muerte). */
  dying: DeathCause | null;
  /** Con analgésico hasta este tick (H5 §5); y si el jugador ha pedido darle uno. */
  painkillerUntil: number;
  painkillerWanted: boolean;
  /** Infección oculta (H5 §7.1): desde cuándo y cuándo muere de ella; el jugador no la ve. */
  infection: { at: number; deathAt: number } | null;
  /** La ropa que lleva puesta (H5b §2; no cuenta como carga). */
  worn: Garment[];
  /** Su prenda favorita y la que odia (H5b §5), distintas. */
  likes: GarmentKind;
  hates: GarmentKind;
  /** Su atuendo (H5b §4). */
  outfitId: number;
  /** Tick desde el que vuelve a mirar si cambiarse de ropa (como mucho una vez por hora). */
  dressCheckAt: number;
  /** Las bolsas que lleva puestas, una por hueco (H5b2 §1). */
  bags: Record<BagSlot, Bag | null>;
  /** «Llevar siempre» (H5b2 §3): lo que no descarga y va a buscar si le falta. */
  keep: Partial<Record<ItemKind, number>>;
  /** Huecos con la bolsa fijada desde la ficha: no se la quita ni la cambia. */
  bagsPinned: BagSlot[];
  /** Su bolsa de la mano, si la soltó (para ir a por ella); `null` si no. */
  droppedBag: number | null;
  /** Si se va de expedición (H5c1). */
  trip: Trip | null;
  /** La bolsa que lleva en la mano para dejarla en el almacén (Transportar, H5b2 §5). */
  haulingBag?: number;
}

/** Un atuendo (H5b §4): las prendas que se puede poner y si acepta ropa de muertos. */
export interface Outfit {
  id: number;
  name: string;
  allowed: GarmentKind[];
  dead: boolean;
  /** Las bolsas que acepta (H5b2 §2) y si acepta bolsa en la mano. */
  bags: BagKind[];
  handBag: boolean;
}

/**
 * Fiebre (H5 §7.2): `since`, cuándo empezó; `rest`, si el jugador ha dicho "Que descanse";
 * `restTicks`, cuánto ha estado acostado desde entonces; `badLuck`, gripe con náuseas aunque
 * descanse (se sortea al empezar); `checks`, cuántas etapas de la gripe se han mirado ya;
 * `graveUntil`, hasta cuándo sigue muy grave la gripe.
 */
export interface Fever {
  cause: 'flu' | 'infection';
  since: number;
  stage: 'fever' | 'nausea' | 'grave';
  rest: boolean;
  restTicks: number;
  badLuck: boolean;
  checks: number;
  graveUntil?: number;
}

/** De qué se muere (H5 §8). */
export type DeathCause = 'blood' | 'wounds' | 'infection' | 'mercy' | 'hunger';

/** Uno o dos desconocidos que esperan a la puerta a que el jugador decida (su decisión caduca). */
export interface Stranger {
  survivors: Survivor[];
  /** Ya se van hacia el borde del mapa. */
  leaving: boolean;
}

/** Armas que se llevan en la mano, de mejor a peor (spec H4b §6.2). */
export type Weapon = 'machete' | 'crowbar' | 'hatchet' | 'axe' | 'bat' | 'knife';

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
  /** La horda de la que salió (H4e), aunque ya haya terminado; `null` si no es de ninguna. */
  hordeId: number | null;
  /** El colono que fue (H5 §8): "Ana (zombi)". */
  name?: string;
  /** El colono que echaron infectado (H5 §7.4), hasta que alguien lo ve. */
  turnedFrom?: number;
  /** La ropa que lleva (H5b §7). */
  worn: Garment[];
  /** Las bolsas que lleva (H5b2 §5, §6), con lo de dentro. */
  bags: Bag[];
}

/** Lado del mapa: 0 norte (y = 0), 1 sur, 2 oeste (x = 0), 3 este. */
export type MapSide = 0 | 1 | 2 | 3;

/** Una horda del narrador (spec H4e §2.1). */
export interface Horde {
  id: number;
  kind: 'siege' | 'wander';
  /** Adonde van: la base (asedio) o un punto del borde contrario (errantes). */
  goal: Point;
  /** Asedio: hasta cuándo se empeña en la base. */
  until?: number;
  /** Ya no manda en sus zombis (acabó el asedio o los errantes salieron del mapa). */
  done: boolean;
  /** Errantes: ya se ha avisado de que se han visto. */
  seen?: boolean;
  /** Asedio: desde cuándo no queda ningún colono en pie (se cansa a las SIEGE_GIVE_UP_HOURS). */
  allDownSince?: number;
  /** Asedio: por dónde llegó (el lado y el punto a lo largo de él), para volverse por ahí. */
  from?: { side: MapSide; center: number };
}

/** Trabajos, en orden de criticidad (spec H4a §3.1; Sanar, de H4e, el primero). */
export type WorkType = 'heal' | 'social' | 'build' | 'craft' | 'haul' | 'chop' | 'loot';

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
  /** Cama de hospital (H5 §6): para quien la necesite, sin dueño. */
  medical?: boolean;
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
  | 'smashWindow'
  // El barreño (H5b §6).
  | 'tub';

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

/**
 * Muebles: la mesa y la hoguera (H4a); el barreño (H5b), que se construye, y los fregaderos y las
 * cisternas de los edificios. `water`: los litros que tiene (barreño y cisterna).
 */
export interface Furniture {
  id: number;
  kind: 'table' | 'campfire' | 'tub' | 'sink' | 'cistern';
  pos: Point;
  water?: number;
}

/** Almacén de la base. */
export interface Storage {
  tiles: Point[];
  items: Inventory;
}

/** `corpse`: el cuerpo de un zombi (H4d), que se registra como un mueble más. */
export type ContainerKind =
  | 'fridge'
  | 'wardrobe'
  | 'shelf'
  | 'corpse'
  // H4f
  | 'counter'
  | 'locker'
  | 'crate'
  | 'medicine';

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
  /** Cuerpos (H4d): tick en que desaparece. */
  until?: number;
  /** Cuerpo de una persona (H5 §8): de quién es ("Cuerpo de Ana"). */
  name?: string;
  /** Cuerpo de un infectado: tick en que se levanta como zombi. */
  risesAt?: number;
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
  | 'flu'
  // Hordas (H4e)
  | 'siege'
  | 'wanderers'
  // Lluvia (H5b)
  | 'rain';

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
  kind: 'theft' | 'birthday' | 'fever' | 'stranger';
  survivorIds: number[];
  expiresAt: number;
  /** Robo: si el sospechoso es el culpable de verdad. */
  guilty?: boolean;
  /** Fiebre (H5): el segundo aviso, "está peor". */
  worse?: boolean;
}

/** Sitios (H5c1 §2): de qué tipo es y si es especial. */
export type SiteKind = 'house' | 'farm' | 'gas' | 'warehouse' | 'village';
export type SiteSpecial = 'survivors' | 'stash' | 'dangerous';

/**
 * Un sitio conocido (H5c1 §2): hacia qué lado y a cuántas horas está, si se ha perdido (quemado),
 * si ya se visitó, hasta cuándo esperan los supervivientes y cuándo se fue el último.
 */
export interface SiteInfo {
  id: number;
  kind: SiteKind;
  special: SiteSpecial | null;
  side: MapSide;
  hours: number;
  state: 'known' | 'lost';
  visited: boolean;
  specialUntil: number | null;
  leftAt: number | null;
  /** Zombis de hordas que llegaron antes de que nadie fuera (se ponen al crearse el sitio). */
  extraZombies: number;
}

/**
 * Un viaje (H5c1 §4): ida a un sitio, vuelta a la base o explorar hacia un lado; quiénes van (con
 * todo lo suyo) y las horas de luz que les faltan.
 */
export interface Travel {
  id: number;
  kind: 'go' | 'back' | 'explore';
  siteId: number | null;
  side: MapSide;
  members: Survivor[];
  hoursLeft: number;
  /** Los que aún tienen que salir del mapa (el viaje empieza cuando han salido todos). */
  pending: number[];
}

/** Su parte de una expedición (H5c1 §4): prepararse en el almacén o ir a la salida. */
export interface Trip {
  travelId: number;
  stage: 'prepare' | 'exit';
  /** Lo que coge del almacén (su parte de la lista del grupo). */
  items: Partial<Record<ItemKind, number>>;
}

/** El terreno de un hexágono del mapa del mundo (H5c2 §1). */
export type Terrain = 'field' | 'forest' | 'hills' | 'water';

/**
 * El mapa del mundo (H5c2 §1): hexágonos en filas (índice fila × ancho + columna), con su terreno,
 * carreteras (sobre el agua, puentes), pueblos y niebla; y el hexágono de la base.
 */
export interface Atlas {
  width: number;
  height: number;
  terrain: Terrain[];
  /** 1 si pasa una carretera. */
  road: number[];
  /** 1 si es un pueblo. */
  town: number[];
  /** 1 si se conoce (sin niebla). */
  seen: number[];
  base: number;
}

/** Las expediciones (H5c1): sitios conocidos, viajes en curso y su propio azar. */
export interface Expedition {
  sites: SiteInfo[];
  travels: Travel[];
  nextSiteId: number;
  rng: RngState;
}

/**
 * Lo común a todos los mapas (H5c1 §1): registro, atuendos, numeración, cuentas, estadísticas,
 * muertos, fin de partida y tiempo. Solo datos (nunca un mundo dentro: así no hay ciclos).
 */
export interface Common {
  /** Registro de sucesos (los últimos LOG_MAX). */
  log: LogEntry[];
  nextId: number;
  /** Hay tormenta mientras el tick sea menor que este. */
  stormUntil: number;
  /** Cuentas de la madera, para comprobar que nunca aparece ni desaparece. */
  /** `wasted`: la que se pierde al fallar al construir (H4c). */
  woodLog: { start: number; chopped: number; recovered: number; spent: number; wasted: number };
  /** Armas que salen de los cuerpos y que se pudren con ellos (para que las cuentas cuadren). */
  /** Armas que aparecen (en los cuerpos y en el botín de los sitios, H5c1) y que se pierden. */
  weaponLog: { fromCorpses: number; fromSites: number; rotted: number };
  nextWoundId: number;
  /** Los colonos que han muerto: quién, el día y de qué. */
  dead: { id: number; name: string; day: number; cause: DeathCause }[];
  /** Fin de partida (H5 §9): cuándo no quedó nadie en la colonia. */
  over: { tick: number } | null;
  /** Para el resumen final. */
  stats: { kills: number; siegesRepelled: number; looted: Inventory; joined: string[] };
  // Ropa (H5b)
  nextPieceId: number;
  /** Cuentas de las piezas: las que se han hecho y las que han desaparecido. */
  pieceLog: { made: number; gone: number };
  outfits: Outfit[];
  nextOutfitId: number;
  /** Llueve mientras el tick sea menor que este (también con tormenta). */
  rainUntil: number;
  /** Bolsas (H5b2): las que se han puesto al encontrarlas, las soltadas y las recogidas. */
  bagLog: { found: number; dropped: number; recovered: number };
  /** Sitios conocidos y viajes (H5c1). */
  expedition: Expedition;
  /**
   * Quien ha muerto o se ha ido de la colonia este tick, y desde qué mapa (`null`: de viaje): los
   * demás mapas se enteran al final del tick (`farewellsSystem`, desde la base).
   */
  departed: { id: number; how: 'died' | 'banished'; mapId: number | null }[];
}

export interface World {
  /** Lo común a todos los mapas (H5c1 §1): el mismo objeto en la base y en cada sitio. */
  common: Common;
  /** 0 la base; en un sitio, su id (H5c1). */
  mapId: number;
  /** Los mapas de los sitios (solo en la base), con su id. */
  siteMaps: { siteId: number; world: World }[];
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
  stranger: Stranger | null;
  narrator: Narrator;
  decisions: Decision[];
  piles: Pile[];
  blueprints: Blueprint[];
  furniture: Furniture[];
  /** Árboles marcados para talar, por índice y·ancho + x. */
  chopMarks: number[];
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
  /** Dónde está el pueblo (H4f): para los zombis y, en H5c, para el mapa global. */
  town: Rect;
  // Hordas (H4e)
  hordes: Horde[];
  nextHordeId: number;
  /** El asedio anunciado que aún no ha llegado. */
  siege: { at: number; side: MapSide; size: number } | null;
  // Heridas y muerte (H5)
  /** Los que echaron, de camino al borde por la carretera (H5 §7.4). */
  leaving: Survivor[];
  /** Los que volverán: el infectado, como zombi; el de la gripe, a pedir entrar. */
  returning: Returning[];
  /** A quién hay que acabar con su sufrimiento (esperan a que alguien pueda). */
  mercy: number[];
  /** Los que echaron (para su nombre en el registro y en los recuerdos, aunque ya no estén). */
  gone: { id: number; name: string }[];
  /** Tick en que se corta el agua corriente (H5b §6). */
  waterCutAt: number;
}

/** Uno que echaron y que vuelve en `at` por donde se fue (`pos`). */
export type Returning =
  | {
      kind: 'zombie';
      at: number;
      pos: Point;
      name: string;
      survivorId: number;
      worn: Garment[];
      bags: Bag[];
    }
  | { kind: 'stranger'; at: number; pos: Point; survivor: Survivor };

/** Recetas de Fabricar (H4d). */
export type RecipeId =
  | 'bandages'
  | 'curtains'
  | 'unpick'
  // Sobre prendas (H5b §3)
  | 'mend'
  | 'pad'
  | 'unpickGarment'
  // En el barreño (H5b §6)
  | 'wash'
  // La bolsa de tela (H5b2 §6)
  | 'sewBag';

/**
 * Un pedido: `count`, hacer N veces (`done` lleva la cuenta); `until`, hasta tener N en el almacén;
 * `always` (H5b, solo sobre prendas), siempre que haya una prenda que lo necesite.
 */
export interface Bill {
  id: number;
  recipe: RecipeId;
  mode: 'count' | 'until' | 'always';
  target: number;
  done: number;
}
