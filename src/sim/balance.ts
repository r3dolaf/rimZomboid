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
export const START_FOOD = 35; // ~10 días para 3 supervivientes; en H3 bajará
export const MOOD_BASE = 50;
export const HUNGER_PER_DAY = 70;
export const HUNGER_PER_TICK = HUNGER_PER_DAY / TICKS_PER_DAY;
export const GLUTTON_HUNGER_MULT = 1.5;
export const SLEEP_DRAIN_PER_TICK = 100 / (16 * TICKS_PER_HOUR); // 16 h despierto
export const SLEEP_GAIN_PER_TICK = 100 / (8 * TICKS_PER_HOUR); // 8 h en cama
export const FLOOR_SLEEP_FACTOR = 0.75;
export const SLEEPYHEAD_SLEEP_MULT = 1.3;
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
