// Decide cuántos ticks de simulación ejecutar en cada fotograma según la velocidad.

import { TICKS_PER_SECOND } from '../sim/balance';

export type Speed = 0 | 1 | 2 | 3;

export interface TimeController {
  /** La velocidad elegida (con todos durmiendo puede ir más rápido: `boosted`). */
  readonly speed: Speed;
  /** Va a `SLEEP_SPEED` porque duermen todos. */
  readonly boosted: boolean;
  /** Elegir 1, 2 o 3 mientras duermen todos manda hasta la noche siguiente; pausar, no. */
  setSpeed(s: Speed): void;
  togglePause(): void;
  /** Si duermen todos (se avisa en cada fotograma). */
  setAllAsleep(asleep: boolean): void;
  /** Ticks que hay que ejecutar tras `dtMs` milisegundos reales. */
  advance(dtMs: number): number;
}

/** Milisegundos reales por tick a x1 (10 ticks por segundo). */
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
/** Tope por fotograma: si la pestaña estuvo en segundo plano, no intentamos ponernos al día. */
export const MAX_FRAME_MS = 250;
/** Con todos durmiendo, para pasar la noche rápido. */
export const SLEEP_SPEED = 6;

export function createTimeController(): TimeController {
  let speed: Speed = 1;
  let lastRunning: Speed = 1;
  let acc = 0;
  let asleep = false;
  /** Esta noche se eligió otra velocidad: no se acelera hasta que alguien despierte. */
  let declined = false;
  const boosted = () => asleep && !declined && speed !== 0;
  const run = (s: Speed) => {
    speed = s;
    if (s !== 0) lastRunning = s;
  };
  return {
    get speed() {
      return speed;
    },
    get boosted() {
      return boosted();
    },
    setSpeed(s) {
      if (s !== 0 && asleep) declined = true;
      run(s);
    },
    // Sin `this`: se puede pasar como callback suelto.
    togglePause: () => run(speed === 0 ? lastRunning : 0),
    setAllAsleep(v) {
      asleep = v;
      if (!v) declined = false;
    },
    advance(dtMs) {
      if (!(dtMs > 0)) return 0; // también descarta NaN
      acc += Math.min(dtMs, MAX_FRAME_MS) * (boosted() ? SLEEP_SPEED : speed);
      const ticks = Math.floor(acc / MS_PER_TICK);
      acc -= ticks * MS_PER_TICK;
      return ticks;
    },
  };
}
