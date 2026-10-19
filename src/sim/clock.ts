import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';

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
