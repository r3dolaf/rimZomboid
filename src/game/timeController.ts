// Decide cuántos ticks de simulación ejecutar en cada fotograma según la velocidad.

export type Speed = 0 | 1 | 2 | 3;

export interface TimeController {
  readonly speed: Speed;
  setSpeed(s: Speed): void;
  togglePause(): void;
  /** Ticks que hay que ejecutar tras `dtMs` milisegundos reales. */
  advance(dtMs: number): number;
}

/** Milisegundos reales por tick a x1 (10 ticks por segundo). */
export const MS_PER_TICK = 100;
/** Tope por fotograma: si la pestaña estuvo en segundo plano, no intentamos ponernos al día. */
export const MAX_FRAME_MS = 250;

export function createTimeController(): TimeController {
  let speed: Speed = 1;
  let lastRunning: Speed = 1;
  let acc = 0;
  return {
    get speed() {
      return speed;
    },
    setSpeed(s) {
      speed = s;
      if (s !== 0) lastRunning = s;
    },
    togglePause() {
      this.setSpeed(speed === 0 ? lastRunning : 0);
    },
    advance(dtMs) {
      if (!(dtMs > 0)) return 0; // también descarta NaN
      acc += Math.min(dtMs, MAX_FRAME_MS) * speed;
      const ticks = Math.floor(acc / MS_PER_TICK);
      acc -= ticks * MS_PER_TICK;
      return ticks;
    },
  };
}
