import {
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  START_HOUR,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
}

const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;

/** Convierte un tick en día y hora de juego. La partida empieza el Día 1 a las 08:00. */
export function gameTime(tick: number): GameTime {
  const total = tick + START_HOUR * TICKS_PER_HOUR;
  const inDay = total % TICKS_PER_DAY;
  return {
    day: Math.floor(total / TICKS_PER_DAY) + 1,
    hour: Math.floor(inDay / TICKS_PER_HOUR),
    minute: Math.floor((inDay % TICKS_PER_HOUR) / TICKS_PER_MINUTE),
  };
}

/** Tick en que empieza el día `d` (a las 00:00; el día 1 empezó antes de la partida). */
export function dayStart(d: number): number {
  return (d - 1) * TICKS_PER_DAY - START_HOUR * TICKS_PER_HOUR;
}

/** De 22:00 a 06:00. */
export function isNight(tick: number): boolean {
  const { hour } = gameTime(tick);
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/** Oscuridad de 0 (día) a 1 (noche): oscurece de 19 a 21 h y aclara de 05 a 07 h. */
export function darkness(tick: number): number {
  const hour = (((tick + START_HOUR * TICKS_PER_HOUR) % TICKS_PER_DAY) / TICKS_PER_HOUR + 24) % 24;
  if (hour >= 21 || hour < 5) return 1;
  if (hour >= 19) return (hour - 19) / 2;
  if (hour < 7) return (7 - hour) / 2;
  return 0;
}
