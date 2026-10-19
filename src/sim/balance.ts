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
