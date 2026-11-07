// Qué ambiente de música toca (spec S1 §2.1).
import type { Mood } from './catalog';

/** Lo que mira la música de la partida. */
export interface MoodInput {
  /** En la portada. */
  title: boolean;
  /** Ha caído la colonia. */
  over: boolean;
  /** Hay un asedio en marcha en la base. */
  siege: boolean;
  /** Zombis que ven los colonos en el mapa que se ve. */
  zombiesSeen: number;
  /** De 0 (día) a 1 (noche). */
  darkness: number;
  /** Milisegundos (reloj de la pantalla). */
  now: number;
}

/** El peligro sigue sonando este rato después del último zombi a la vista. */
export const DANGER_HOLD_MS = 20_000;

/** Elige el ambiente; recuerda cuándo se vio el último zombi. */
export function createMoodPicker() {
  let lastZombieAt = -Infinity;
  return {
    pick(i: MoodInput): Mood {
      if (i.zombiesSeen > 0) lastZombieAt = i.now;
      if (i.title) return 'title';
      if (i.over) return 'end';
      if (i.siege) return 'siege';
      if (i.now - lastZombieAt < DANGER_HOLD_MS) return 'danger';
      return i.darkness >= 0.5 ? 'night' : 'day';
    },
  };
}

const calm = (m: Mood | null) => m === 'day' || m === 'night';

/** ¿Hay que cortar el tema que suena? Entre el día y la noche, no: se cambia al terminar. */
export function switchNow(playing: Mood | null, wanted: Mood): boolean {
  if (playing === wanted) return false;
  return !(calm(playing) && calm(wanted));
}
