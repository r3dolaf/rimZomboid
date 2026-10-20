// Todas las cifras ajustables del juego. Se retocan jugando.

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
export const ITEM_WEIGHT_KG = { food: 0.5, bandage: 0.1, knife: 0.5, bat: 1.5 } as const;
export const CARRY_CAPACITY_KG = 8;
export const LOOT_FOOD_TOTAL = 80; // + START_FOOD ≈ 25 días para 3 supervivientes
export const LOOT_BANDAGE_TOTAL = 15;
export const CONTAINERS_MIN = 2;
export const CONTAINERS_MAX = 5;
export const KNIFE_CHANCE = 0.08; // × (0,5 + distancia normalizada)
export const BAT_CHANCE = 0.06;

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
// que charla a diario todos acababan en 100 con todos en una semana.
export const OPINION_DECAY_PER_DAY = 1;
export const OPINION_DECAY_FRACTION = 0.1;
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
export const STRANGER_EVERY_DAYS_MIN = 3;
export const STRANGER_EVERY_DAYS_MAX = 6;
