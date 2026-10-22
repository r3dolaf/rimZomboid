// Todas las cifras ajustables del juego. Se retocan jugando.
import type { ItemKind } from './items';
import { Tile, type BuildKind, type LootKind, type RecipeId, type Weapon } from './types';

// Tiempo
export const TICKS_PER_SECOND = 10;
export const TICKS_PER_HOUR = 300;
export const TICKS_PER_DAY = 24 * TICKS_PER_HOUR; // 7200 = 12 minutos reales a x1
export const START_HOUR = 8;

// Mundo
export const MAP_SIZE = 100;
export const HOUSE_COUNT_MIN = 6;
export const HOUSE_COUNT_MAX = 10;
export const TREE_DENSITY = 0.03;

// Supervivientes
export const SURVIVOR_COUNT = 3;
export const SURVIVOR_WALK_SPEED = 0.15; // casillas por tick
export const IDLE_TICKS_MIN = 20;
export const IDLE_TICKS_MAX = 80;
export const NO_PATH_RETRY_TICKS = 10;

// Personas (H2)
export const NEED_START_MIN = 60;
export const NEED_START_MAX = 100;
export const START_FOOD = 10; // ~3 días; el resto hay que saquearlo (H3)
export const MOOD_BASE = 50;
export const HUNGER_PER_DAY = 70;
export const HUNGER_PER_TICK = HUNGER_PER_DAY / TICKS_PER_DAY;
export const GLUTTON_HUNGER_MULT = 1.5;
// 18 h despierto: quien se levanta a las 06:00 llega a las 22:00 sin desplomarse y se acuesta por la
// regla de noche (con 16 h todos llegaban a < 10 cada tarde y las crisis nunca podían terminar).
export const SLEEP_DRAIN_PER_TICK = 100 / (18 * TICKS_PER_HOUR);
export const SLEEP_GAIN_PER_TICK = 100 / (8 * TICKS_PER_HOUR); // 8 h en cama
export const FLOOR_SLEEP_FACTOR = 0.75;
export const SLEEPYHEAD_SLEEP_MULT = 1.3;
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
export const MOOD_RATE_PER_TICK = 10 / TICKS_PER_HOUR; // 10 puntos por hora de juego
export const MOOD_EDGE = 25; // al límite
export const MOOD_CRISIS = 10;
export const HUNGRY_BELOW = 25;
export const HUNGRY_MOOD = -10;
export const STARVING_MOOD = -25;
export const TIRED_BELOW = 20;
export const TIRED_MOOD = -10;
export const OPTIMIST_MOOD = 10;
export const PESSIMIST_MOOD = -10;
/** Efecto en el ánimo y duración (horas de juego) de cada recuerdo. */
export const MEMORY_EFFECTS = {
  sleptInBed: { value: 5, hours: 12 },
  sleptOnFloor: { value: -5, hours: 12 },
  ate: { value: 5, hours: 6 },
  vented: { value: 15, hours: 24 },
  goodChat: { value: 3, hours: 6 },
  argued: { value: -5, hours: 12 },
  insulted: { value: -8, hours: 12 },
  fought: { value: -10, hours: 24 },
  consoled: { value: 10, hours: 12 },
  consoledByPartner: { value: 15, hours: 12 },
  sharedFood: { value: 5, hours: 12 },
  breakup: { value: -15, hours: 72 },
  sleptWithPartner: { value: 5, hours: 12 },
  punished: { value: -15, hours: 48 },
  punishedUnfairly: { value: -25, hours: 72 },
  thiefAmongUs: { value: -5, hours: 48 },
  jealous: { value: -10, hours: 24 },
  clash: { value: -5, hours: 72 },
  grief: { value: -20, hours: 48 },
  foodFight: { value: -5, hours: 24 },
  storyNight: { value: 8, hours: 24 },
  happyBirthday: { value: 15, hours: 24 },
  party: { value: 5, hours: 12 },
  ruinedBirthday: { value: -10, hours: 24 },
  forgottenBirthday: { value: -8, hours: 48 },
  storm: { value: -6, hours: 18 },
  ateAtTable: { value: 3, hours: 6 },
  byTheFire: { value: 4, hours: 1 },
  downed: { value: -15, hours: 24 },
  notConsoled: { value: 0, hours: 1 }, // no pesa en el ánimo: solo bloquea consolar
} as const;
export const EAT_BELOW = 35;
export const EAT_RESTORE = 60;
export const EAT_TICKS = 30; // 6 minutos de juego
// De noche casi todos se acuestan (< 95) y nadie se levanta hasta las 06:00: así los ritmos se
// sincronizan con la noche aunque alguien eche una siesta de día (< 10).
export const SLEEP_AT_NIGHT_BELOW = 95;
export const SLEEP_ANYTIME_BELOW = 10;
export const CRISIS_TICKS = 2 * TICKS_PER_HOUR;
export const CRISIS_BREAK_HUNGER = 10;

// Objetos y saqueo (H3)
export const ITEM_WEIGHT_KG = {
  food: 0.5,
  bandage: 0.1,
  knife: 0.5,
  bat: 1.5,
  axe: 2,
  wood: 1,
  // H4d
  cloth: 0.2,
  curtains: 0.5,
  thread: 0.01, // por uso (un carrete de 10 usos, 0,1 kg)
  needle: 0.05,
  crowbar: 2,
  machete: 1,
} as const;
export const LOOT_FOOD_TOTAL = 80; // + START_FOOD ≈ 25 días para 3 supervivientes
export const LOOT_BANDAGE_TOTAL = 15;
export const CONTAINERS_MIN = 2;
export const CONTAINERS_MAX = 5;
export const KNIFE_CHANCE = 0.14; // × (0,5 + distancia normalizada); H4b: más armas
export const BAT_CHANCE = 0.1;
export const START_WEAPON = 'knife' as const; // H4b: sin arma, caían enseguida

// Visión (H3)
export const VISION_DAY = 12;
export const VISION_NIGHT = 6;
export const VISION_EVERY_TICKS = 5;
export const LOG_MAX = 100;
export const SEARCH_TICKS = 30; // registrar un contenedor: 6 minutos de juego
export const UNLOAD_TICKS = 20;
export const REFUSE_CHANCE = 0.5; // al límite, probabilidad de negarse a un trabajo
export const REFUSE_TICKS = TICKS_PER_HOUR;
export const SCARED_OUTSIDE_MOOD = -10; // Cobarde fuera de la base
export const INITIAL_REVEAL = 8; // casillas alrededor de la base que se conocen al empezar

// Relaciones (H3b)
export const OPINION_LIMIT = 100; // de −100 a 100
export const START_OPINION_MIN = -10;
export const START_OPINION_MAX = 20;
// Cada día la opinión se acerca a 0 un 10 % (al menos 1 punto): sin esto, en un grupo pequeño
// que charla a diario todos acababan en 100 con todos en una semana. Lo malo se olvida más
// despacio (3 %): si no, nunca llegaba a haber rivales.
export const OPINION_DECAY_PER_DAY = 1;
export const OPINION_DECAY_FRACTION = 0.1;
export const OPINION_DECAY_FRACTION_NEGATIVE = 0.03;
export const FRIEND_OPINION = 40;
export const RIVAL_OPINION = -40;
export const SOCIAL_PER_TICK = 50 / TICKS_PER_DAY;
export const LONELY_BELOW = 20;
export const LONELY_MOOD = -10;
export const CHAT_RANGE = 6;
export const CHAT_EVERY_MIN = 450;
export const CHAT_EVERY_MAX = 750;
export const CHAT_RETRY_TICKS = 30;
/** Pesos de cada tipo de charla y cuánto los mueven la opinión, el ánimo y los rasgos. */
export const CHAT_WEIGHTS = { pleasant: 60, neutral: 30, argue: 10, insult: 0 } as const;
export const CHAT_OPINION_PLEASANT = 0.3; // × opinión
export const CHAT_OPINION_ARGUE = -0.1; // × opinión
export const CHAT_OPINION_INSULT = -0.1; // × opinión, solo si es negativa
export const CHAT_LOW_MOOD_ARGUE = 15;
export const CHAT_LOW_MOOD_INSULT = 10;
export const CHAT_OPTIMIST_PLEASANT = 15;
export const CHAT_PESSIMIST_PLEASANT = -10;
export const CHAT_PESSIMIST_ARGUE = 10;
/** Lo que cambia una charla en la opinión y en la necesidad social de los dos. */
export const CHAT_EFFECTS = {
  pleasant: { opinion: 2, social: 15 },
  neutral: { opinion: 1, social: 8 },
  argue: { opinion: -4, social: 3 },
  insult: { opinion: -8, social: 3 },
} as const;
export const SHARE_HUNGER_BELOW = 35;
export const SHARE_OPINION = 5;
export const FIGHT_OPINION = -40; // rivales: alguno tiene al otro aquí o por debajo
export const FIGHT_CHANCE = 0.3;
export const FIGHT_TICKS = 30;
export const FIGHT_OPINION_LOSS = 15;
export const CONSOLE_OPINION = 20; // opinión mínima para ir a consolar (salvo a la pareja)
export const CONSOLE_RANGE = 2;
export const CONSOLE_TICKS = 30;
export const CONSOLE_OPINION_GAIN = 3;
export const PARTNER_OPINION = 60; // los dos se tienen al menos esto
export const PARTNER_CHANCE = 0.1; // tras una charla agradable
export const BREAKUP_BELOW = 20;
export const BREAKUP_OPINION_LOSS = 20;
export const BUBBLE_TICKS = 30;
/** Cama de cada colono por orden de llegada, relativa a la esquina de la base. */
export const BED_SLOTS: readonly { dx: number; dy: number }[] = [
  { dx: 2, dy: 1 },
  { dx: 5, dy: 1 },
  { dx: 9, dy: 1 },
  { dx: 2, dy: 3 },
  { dx: 9, dy: 3 },
];
export const COLONY_MAX = 8;
export const STRANGER_FIRST_TICK = 3 * TICKS_PER_DAY;
export const STRANGER_PAIR_CHANCE = 0.25;
export const STRANGER_PAIR_OPINION_MIN = 60;
export const STRANGER_PAIR_OPINION_MAX = 80;
export const DECISION_TICKS = TICKS_PER_DAY; // sin respuesta, se aplica la opción por defecto
export const STRANGER_NEED_MIN = 30; // viene de pasarlo mal
export const STRANGER_NEED_MAX = 90;
export const STRANGER_FOOD_MAX = 4;
export const STRANGER_BANDAGE_CHANCE = 0.3;

// Narrador (H3c)
export const EVENTS_START = 1.5 * TICKS_PER_DAY; // el primer día y medio, sin sucesos
export const CALM_DAYS_MIN = 2;
export const CALM_DAYS_MAX = 3;
export const TENSION_DAYS_MIN = 1;
export const TENSION_DAYS_MAX = 2;
/** Separación entre sucesos, en ticks: [mínimo, máximo]. */
export const EVENT_GAP = {
  balancedCalm: [1.5 * TICKS_PER_DAY, 2.5 * TICKS_PER_DAY],
  balancedTension: [0.5 * TICKS_PER_DAY, TICKS_PER_DAY],
  calm: [2 * TICKS_PER_DAY, 4 * TICKS_PER_DAY],
  chaotic: [6 * TICKS_PER_HOUR, 3 * TICKS_PER_DAY],
} as const;
export const CHAOTIC_DOUBLE_CHANCE = 0.2; // otro suceso 1 h después
export const EVENT_RETRY_TICKS = TICKS_PER_HOUR;
/** Pesos de cada tono que busca cada estilo (y fase). */
export const TONE_WEIGHTS = {
  balancedCalm: { good: 60, mixed: 40, bad: 0 },
  calm: { good: 35, mixed: 25, bad: 40 },
  chaotic: { good: 1, mixed: 1, bad: 1 },
} as const;
export const RESPITE_BELOW = 35; // Equilibrado en calma: por debajo, solo buenos
export const TENSION_BREAK_BELOW = 25; // Equilibrado: por debajo, la tensión acaba
export const CALM_NO_BAD_BELOW = 40; // Tranquilo: por debajo, nunca malos
export const HARSH_ABOVE = 60; // en tensión, por encima los duros pesan más
export const GENTLE_BELOW = 40; // en tensión, por debajo los leves pesan más
/** Peso de cada parte del bienestar. */
export const WELLBEING_WEIGHTS = { mood: 0.4, opinion: 0.3, food: 0.3 } as const;
export const WELLBEING_FOOD_DAYS = 5; // con estos días de comida o más, la comida cuenta al máximo
// Sucesos sociales (H3c §3.1)
export const THEFT_MIN_FOOD = 3;
export const THEFT_CANS_MAX = 3;
export const THEFT_GUILTY_CHANCE = 0.6;
export const THEFT_SUSPICION = 10; // opinión que pierden los demás del sospechoso (y otro tanto si se deja estar)
export const THEFT_UNFAIR_OPINION = 20; // el castigado sin culpa, de todos
export const THEFT_HUNGRY_BELOW = 50;
export const JEALOUSY_ADMIRER = 20; // opinión del tercero sobre la pareja
export const JEALOUSY_OPINION = 20; // de los celos hacia el tercero
export const JEALOUSY_COUPLE_OPINION = 10;
export const CLASH_BELOW = 30;
export const CLASH_ARGUE = 30;
export const CLASH_INSULT = 10;
export const FOOD_FIGHT_PER_COLONIST = 2; // con menos latas por colono hay disputa
export const FOOD_FIGHT_OPINION = 5;
export const GOSSIP_OPINION = 15;
export const GOSSIP_FOUND_CHANCE = 0.3;
export const GOSSIP_FOUND_OPINION = 20;
// Sucesos buenos (H3c §3.2)
export const STORY_NIGHT_FROM_HOUR = 19;
export const STORY_NIGHT_TO_HOUR = 23; // sin incluir
export const STORY_NIGHT_OPINION = 3;
export const STORY_NIGHT_RUIN_CHANCE = 0.4;
export const STORY_NIGHT_ARGUE_OPINION = 10;
export const BIRTHDAY_CANS = 2;
export const BIRTHDAY_OPINION = 5;
export const BIRTHDAY_RUIN_CHANCE = 0.3;
export const BIRTHDAY_RUIN_OPINION = 15;
export const CACHE_CANS_MIN = 3;
export const CACHE_CANS_MAX = 6;
// Tormenta y gripe (H3c §3.3)
export const STORM_HOURS_MIN = 8;
export const STORM_HOURS_MAX = 12;
export const STORM_SLEEP_FACTOR = 0.75;
export const FLU_DAYS = 4;
export const FLU_REST_DAYS = 2;
export const FLU_HUNGER_MULT = 1.3;
export const FLU_MOOD = -10;
export const WORKING_SICK_MOOD = -5;

// Defensa y trabajos (H4a)
export const LOOT_WOOD_TOTAL = 40; // en armarios y estanterías
export const AXE_CHANCE = 0.08; // × (0,5 + distancia normalizada), por mueble

// Tela, hilo, agujas, palancas y machetes (H4d): aparte, con su propio azar.
export const LOOT_CLOTH_TOTAL = 30; // 70 % en armarios, 30 % en estanterías
export const CLOTH_WARDROBE_SHARE = 0.7;
export const THREAD_SPOOLS = 6;
export const THREAD_PER_SPOOL = 10; // usos de hilo por carrete
export const NEEDLE_TOTAL = 3;
export const CROWBAR_CHANCE = 0.06; // × (0,5 + distancia normalizada), por mueble (no en neveras)
export const MACHETE_CHANCE = 0.04;
export const CRAFT_LOOT_SALT = 0x5eed7e1a; // el azar de este botín: semilla ^ esto

// Fabricar (H4d): recetas de la mesa y pedidos.
export interface Recipe {
  input: Partial<Record<ItemKind, number>>;
  /** Herramienta que hace falta (no se gasta): la aguja, en el almacén; el cuchillo, también en la mano. */
  tool: 'needle' | 'knife' | null;
  output: Partial<Record<ItemKind, number>>;
  /** Con Fabricar 5. */
  ticks: number;
}
export const RECIPES: Record<RecipeId, Recipe> = {
  bandages: {
    input: { cloth: 1 },
    tool: null,
    output: { bandage: 2 },
    ticks: 0.25 * TICKS_PER_HOUR,
  },
  curtains: {
    input: { cloth: 3, thread: 2 },
    tool: 'needle',
    output: { curtains: 1 },
    ticks: TICKS_PER_HOUR,
  },
  unpick: {
    input: { curtains: 1 },
    tool: 'knife',
    output: { cloth: 3 },
    ticks: 0.25 * TICKS_PER_HOUR,
  },
};
export const BILL_DEFAULT_TARGET = 5; // un pedido nuevo: "hasta tener 5"

// Cuerpos de zombi (H4d): lo que llevan (con el azar de los zombis) y cuándo desaparecen.
export const CORPSE_CLOTH_MIN = 1;
export const CORPSE_CLOTH_MAX = 2;
export const CORPSE_WEAPON_CHANCE = 0.1;
/** Qué arma, si lleva (pesos). */
export const CORPSE_WEAPONS = { knife: 35, bat: 25, crowbar: 15, machete: 15, axe: 10 } as const;
export const CORPSE_SMALL_CHANCE = 0.15; // una venda o una lata, mitad y mitad
export const CORPSE_ROT_TICKS = 3 * TICKS_PER_DAY; // sin registrar, se pudre (con lo que lleve)
export const CORPSE_EMPTY_TICKS = TICKS_PER_DAY; // registrado y vacío, desaparece

// Puertas atrancadas (H4d): se fuerzan con la palanca.
export const LOCKED_DOOR_CHANCE = 0.25; // por casa (la base, nunca)
export const LOCKED_DOOR_SALT = 0x10cd00e5; // su azar: semilla ^ esto
export const PRY_TICKS = 0.5 * TICKS_PER_HOUR; // con Saquear 5
export const PRY_NOISE_TICKS = 30; // cada cuánto se oye un golpe
export const CHOP_TICKS = TICKS_PER_HOUR;
export const CHOP_WOOD_MIN = 4;
export const CHOP_WOOD_MAX = 6;
export const HUNGRY_LOOT_DAYS = 2; // con menos días de comida, saquear sube a lo más urgente
export const TABLE_RANGE = 3;
export const CAMPFIRE_RANGE = 4;
export const FURNITURE_EVERY_TICKS = 30; // cada cuánto se renueva "Junto al fuego"
export const UNBOARD_WOOD = 1; // lo que devuelve quitar las tablas de una ventana
/** Madera y tiempo de cada plano (spec H4a §4.1). */
export const BUILD = {
  bed: { wood: 6, ticks: 2 * TICKS_PER_HOUR },
  table: { wood: 4, ticks: 1.5 * TICKS_PER_HOUR },
  campfire: { wood: 3, ticks: 0.5 * TICKS_PER_HOUR },
  woodWall: { wood: 2, ticks: TICKS_PER_HOUR },
  woodDoor: { wood: 4, ticks: 1.5 * TICKS_PER_HOUR },
  board: { wood: 3, ticks: 0.5 * TICKS_PER_HOUR },
  unboard: { wood: 0, ticks: 0.25 * TICKS_PER_HOUR },
  // Reparar (H4b): lo dañado sin romper, y una puerta rota.
  repair: { wood: 1, ticks: 0.25 * TICKS_PER_HOUR },
  fixDoor: { wood: 2, ticks: TICKS_PER_HOUR },
  // Cortinas (H4d): no gastan madera; colgarlas gasta unas cortinas (CURTAINS_COST).
  curtains: { wood: 0, ticks: 5 * (TICKS_PER_HOUR / 60) },
  takeDownCurtains: { wood: 0, ticks: 10 * (TICKS_PER_HOUR / 60) },
  hangCurtains: { wood: 0, ticks: 15 * (TICKS_PER_HOUR / 60) },
  // Romper una ventana a propósito (H4d), para entrar en una casa cerrada.
  smashWindow: { wood: 0, ticks: 2 * (TICKS_PER_HOUR / 60) },
} as const;
/** Cortinas que necesita cada plano (H4d). */
export const CURTAINS_COST: Partial<Record<BuildKind, number>> = { hangCurtains: 1 };

// Habilidades (H4c)
export const SKILL_MAX = 10;
export const SKILL_START_MAX = 3; // al empezar, cada una entre 0 y esto…
export const SPECIALTY_MIN = 5; // …salvo la especialidad, entre esto…
export const SPECIALTY_MAX = 7; // …y esto
export const SKILL_SPEED_MIN = 0.5; // rapidez con nivel 0…
export const SKILL_SPEED_PER_LEVEL = 0.1; // …y lo que sube por nivel (con 5, ×1, como antes)
export const BUILD_FAIL_BASE = 0.3; // probabilidad de fallar al terminar con nivel 0…
export const BUILD_FAIL_PER_LEVEL = 0.04; // …lo que baja por nivel (10 % con 5, 0 desde 8)
export const CLUMSY_FAIL = 0.1; // Torpe: lo que suma
export const CARRY_BASE_KG = 6; // capacidad con Transportar 0…
export const CARRY_PER_LEVEL_KG = 0.4; // …y lo que sube por nivel (con 5, los 8 kg de antes)
export const LOAD_BRAKE_BASE = 0.4; // a plena carga, cuánto frena con Transportar 0…
export const LOAD_BRAKE_PER_LEVEL = 0.03; // …y lo que baja por nivel (25 % con 5, 10 % con 10)
// Acierto con Pelear 0 y lo que sube por nivel: 60 % con 0, 75 % con 5, 90 % con 10. (Con 50 %
// a nivel 0, como casi todos empiezan entre 0 y 3, caían 4 veces más la primera semana.)
export const FIGHT_HIT_BASE = 0.6;
export const FIGHT_HIT_PER_LEVEL = 0.03;
export const CONSOLE_OK_BASE = 0.5; // consolar sale bien con Social 0…
export const CONSOLE_OK_PER_LEVEL = 0.05; // …y lo que sube por nivel (75 % con 5, siempre con 10)
/** Práctica de Social: por consolar (salga bien o mal) y por charla agradable. */
export const SOCIAL_XP = { console: 60, chat: 10 } as const;
/** Aprende rápido / despacio: cuánto cuenta la práctica. */
export const LEARN_MULT = { fastLearner: 1.5, slowLearner: 0.5 } as const;
/** Lo que suma o resta cada rasgo a las habilidades al empezar. */
export const TRAIT_SKILL_MODS = {
  brave: { fight: 2 },
  coward: { fight: -2 },
  handy: { build: 2, craft: 2 },
  clumsy: { build: -2, craft: -2 },
  strong: { haul: 2, chop: 2 },
  weak: { haul: -2, chop: -2 },
  pleasant: { social: 2 },
  unpleasant: { social: -2 },
  keenEye: { loot: 2 },
} as const;

// Zombis (H4b)
/** Zombis al empezar, máximo y cada cuántas horas llega uno por los bordes, según el narrador. */
// Caótico era 35/70/1 h y Muchos ×1,5: sin defensas, en Caótico/muchos caían el 80 % del tiempo.
export const ZOMBIE_START = { calm: 15, balanced: 25, chaotic: 30 } as const;
export const ZOMBIE_MAX = { calm: 30, balanced: 50, chaotic: 60 } as const;
export const ZOMBIE_EVERY_HOURS = { calm: 4, balanced: 2, chaotic: 1.5 } as const;
/** Opción Zombis de la portada: multiplica lo anterior (y el ritmo de llegada). */
export const ZOMBIE_LEVEL_MULT = { few: 0.5, normal: 1, many: 1.25 } as const;
export const ZOMBIE_SAFE_RADIUS = 20; // al empezar, ninguno más cerca de la base
export const ZOMBIE_HOUSE_RADIUS = 6; // al empezar, junto a una casa
export const ZOMBIE_EDGE_START_DAY = 2;
export const ZOMBIE_HEALTH = 60;
/** Resistencia de lo que pueden romper los zombis (spec H4b §4.1). */
export const RESISTANCE: Partial<Record<Tile, number>> = {
  [Tile.Window]: 60,
  [Tile.CurtainedWindow]: 60, // H4d: como la ventana
  [Tile.BoardedWindow]: 180,
  [Tile.Door]: 100,
  [Tile.LockedDoor]: 150, // H4d: atrancada, aguanta más
  [Tile.WoodWall]: 200,
  [Tile.Wall]: 800,
};
export const ZOMBIE_SPEED = 0.1; // casillas por tick (un colono andando, 0,15)
export const ZOMBIE_HIT_TICKS = 15; // entre golpes, a un colono o a lo que rompe
export const ZOMBIE_BREAK_DAMAGE = 5; // por golpe a una puerta, ventana o muro
export const ZOMBIE_PATH_BUDGET = 4000; // casillas que puede explorar una búsqueda de camino
export const ZOMBIE_VISION = 8; // casillas, de día y de noche
export const CAMPFIRE_SIGHT = 15; // de noche, un zombi ve una hoguera hasta esta distancia
export const SURVIVOR_RUN_SPEED = 0.25; // casillas por tick, al huir o ir a por un zombi
/** Radio de cada ruido, en casillas (spec H4b §3). */
export const NOISE = {
  fightHit: 10,
  broken: 12,
  zombieHit: 8,
  chop: 8,
  build: 6,
  run: 5,
  pry: 8, // H4d: forzar una puerta con la palanca
} as const;
export const CHOP_NOISE_TICKS = 30; // cada cuánto suena un hachazo
export const BUILD_NOISE_TICKS = 30; // cada cuánto suena un martillazo
export const RUN_NOISE_TICKS = 10; // cada cuánto se oyen los pasos de quien corre
export const ZOMBIE_THINK_TICKS = 5; // cada cuánto decide cada zombi (repartidos por id)
export const ZOMBIE_REPATH_TICKS = 20; // al perseguir, cada cuánto rehace el camino
export const LOSE_TRACK_TICKS = 50; // sin ver a su presa este tiempo, pierde el rastro
export const ZOMBIE_REACH = 1.5; // casillas de centro a centro para golpear
export const ZOMBIE_HIT_CHANCE = 0.4;
export const ZOMBIE_DAMAGE_MIN = 8;
export const ZOMBIE_DAMAGE_MAX = 12;
export const HERD_RANGE = 10; // al vagar, se fija en los zombis a esta distancia
export const HERD_CHANCE = 0.75; // de los paseos, cuántos van hacia el grupo
export const WANDER_MIN = 3;
export const WANDER_MAX = 8;
export const BORED_TICKS = 3 * TICKS_PER_HOUR; // sin nada que le llame la atención, se va lejos
export const WANDER_FAR_MIN = 12;
export const WANDER_FAR_MAX = 25;
export const WANDER_PAUSE_MIN = 20;
export const WANDER_PAUSE_MAX = 80;
export const WANDER_PATH_BUDGET = 1500;
export const ARRIVAL_GOAL_RADIUS = 6; // los que llegan van hacia una casa al azar, a esta distancia o menos
export const DOWNED_TICKS = 4 * TICKS_PER_HOUR;
export const DOWNED_MAX_TICKS = 8 * TICKS_PER_HOUR; // con zombis a la vista espera, pero no más de esto
/** Salud que se recupera por hora (spec H4b §5). */
export const HEALTH_PER_HOUR = { awake: 1, floor: 4, bed: 6 } as const;
export const GET_UP_HEALTH = 15; // al levantarse tras un derribo
export const HURT_BELOW = 50; // "Herido" por debajo de esto
export const HURT_MOOD = -10;
/** Golpes de los colonos según lo que llevan en la mano (spec H4b §6.1). */
export const WEAPON_STATS = {
  none: { damage: 5, ticks: 10 },
  knife: { damage: 15, ticks: 10 },
  bat: { damage: 25, ticks: 15 },
  axe: { damage: 40, ticks: 20 },
  crowbar: { damage: 30, ticks: 15 }, // H4d
  machete: { damage: 35, ticks: 15 },
} as const;

export const HEAD_HIT_CHANCE = 1 / 6; // de los golpes que aciertan; hacen el doble
export const SURVIVOR_REACH = 1.5; // casillas de centro a centro para golpear
// Posturas y peligro (spec H4b §7)
export const DANGER_RANGE = 8; // como mucho, aunque de día vean más lejos
export const FLEE_HEALTH = 20; // por debajo, huye siempre
export const DECIDE_MIN_HEALTH = 50;
export const DECIDE_MAX_THREATS = 2;
export const UNARMED_MIN_HEALTH = 70;
export const UNARMED_MAX_THREATS = 1;
export const ALLY_RANGE = 5; // compañeros peleando a esta distancia o menos
export const WAKE_RANGE = 4; // un zombi que ve tan cerca despierta a quien duerme
export const WAKE_MIN_SLEEP = 5; // rendido de sueño (desplomado), solo le despierta un golpe
export const FLED_LOG_TICKS = TICKS_PER_HOUR; // "huye a la base", como mucho una vez por hora y colono
export const SHELTER_WAIT_TICKS = 10; // en la base, sin sitio adonde ir, espera esto y vuelve a mirar
export const SIGHTED_NEAR_BASE = 15; // aviso del primer zombi visto a esta distancia de la base

// H4f Pueblo: edificios y su botín.

/** Tamaño (ancho y alto), muebles de saqueo y probabilidad de puerta atrancada (spec H4f §3). */
export const BUILDINGS: Record<
  LootKind,
  { w: [number, number]; h: [number, number]; containers: [number, number]; locked: number }
> = {
  house: { w: [8, 12], h: [7, 10], containers: [2, 5], locked: 0.25 },
  supermarket: { w: [14, 18], h: [12, 16], containers: [12, 20], locked: 0.4 },
  pharmacy: { w: [8, 10], h: [7, 9], containers: [3, 6], locked: 0.4 },
  hardware: { w: [10, 14], h: [8, 12], containers: [5, 8], locked: 0.4 },
  police: { w: [12, 16], h: [10, 14], containers: [5, 8], locked: 0.5 },
  clothes: { w: [10, 12], h: [8, 10], containers: [5, 8], locked: 0.4 },
  gas: { w: [8, 8], h: [6, 6], containers: [3, 5], locked: 0.25 },
  farm: { w: [14, 18], h: [10, 14], containers: [5, 8], locked: 0.15 },
  warehouse: { w: [16, 22], h: [12, 16], containers: [10, 16], locked: 0.5 },
};

/** Cuánto de algo: un rango que se sortea, o "a veces uno" con su probabilidad. */
export type LootAmount = [number, number] | { chance: number };

/** Lo que se reparte (el hilo, en carretes de THREAD_PER_SPOOL usos). */
export type LootItem = 'food' | 'bandage' | 'wood' | 'cloth' | 'thread' | 'needle' | Weapon;

/** El botín de cada tipo de edificio (spec H4f §4). */
export const LOOT: Record<LootKind, Partial<Record<LootItem, LootAmount>>> = {
  house: {
    food: [2, 5],
    bandage: [0, 1],
    wood: [0, 2],
    cloth: [0, 2],
    thread: { chance: 0.2 },
    needle: { chance: 0.05 },
    knife: { chance: 0.25 },
    bat: { chance: 0.15 },
  },
  supermarket: { food: [40, 60], bandage: [1, 3], knife: [1, 1] },
  pharmacy: { food: [0, 4], bandage: [12, 18], needle: [1, 1] },
  hardware: {
    bandage: [0, 2],
    wood: [16, 24],
    thread: [2, 2],
    needle: [1, 1],
    axe: [2, 2],
    crowbar: [2, 2],
    machete: [1, 1],
    knife: [1, 1],
  },
  police: { food: [2, 6], bandage: [2, 4], bat: [2, 2], crowbar: [1, 1], machete: [1, 1] },
  clothes: { cloth: [20, 30], thread: [6, 6], needle: [3, 3] },
  gas: { food: [8, 16], bandage: [0, 2], bat: [1, 1] },
  farm: {
    food: [8, 16],
    bandage: [0, 2],
    wood: [6, 10],
    cloth: [1, 3],
    axe: [1, 1],
    machete: [1, 1],
  },
  warehouse: {
    food: [2, 6],
    bandage: [0, 2],
    wood: [20, 30],
    cloth: [5, 10],
    crowbar: [1, 1],
    axe: [1, 1],
  },
};
