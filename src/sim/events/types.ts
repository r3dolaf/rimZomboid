import type { EventId, Tone, World } from '../types';

/** Un suceso del narrador (spec H3c §3). */
export interface GameEvent {
  id: EventId;
  tone: Tone;
  /** Solo los malos: 1 (leve) a 3 (duro). */
  severity?: 1 | 2 | 3;
  /** Días que tienen que pasar antes de que vuelva a salir. */
  cooldownDays: number;
  /** N1: tiene su propio ritmo (el asedio): el sorteo del narrador no lo saca. */
  scheduled?: boolean;
  /** Sin azar ni efectos: solo mira si se puede dar ahora. */
  canHappen(w: World): boolean;
  happen(w: World): void;
}
