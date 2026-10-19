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
