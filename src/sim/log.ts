import { LOG_MAX } from './balance';
import type { Inventory } from './items';
import type { World } from './types';

/** Suceso del registro: solo datos; la interfaz los convierte en texto. */
export type LogEvent =
  | { kind: 'found'; survivorId: number; houseId: number; items: Inventory }
  | { kind: 'emptyContainer'; survivorId: number; houseId: number }
  | { kind: 'houseEmptied'; houseId: number }
  | { kind: 'refused'; survivorId: number }
  | { kind: 'crisis'; survivorId: number }
  | { kind: 'vented'; survivorId: number }
  | { kind: 'collapsed'; survivorId: number }
  | { kind: 'outOfFood' }
  | { kind: 'insult'; survivorId: number; otherId: number }
  | { kind: 'sharedFood'; survivorId: number; otherId: number }
  | { kind: 'fight'; survivorId: number; otherId: number }
  | { kind: 'consoled'; survivorId: number; otherId: number }
  | { kind: 'couple'; survivorId: number; otherId: number }
  | { kind: 'breakup'; survivorId: number; otherId: number }
  // El desconocido aún no es colono: se guarda su nombre.
  | { kind: 'strangerArrived'; name: string }
  | { kind: 'strangerAccepted'; name: string }
  | { kind: 'strangerRejected'; name: string }
  | { kind: 'strangerLeft'; name: string };

export type LogEntry = LogEvent & { tick: number };

export function logEvent(w: World, e: LogEvent): void {
  w.log.push({ tick: w.tick, ...e });
  if (w.log.length > LOG_MAX) w.log.splice(0, w.log.length - LOG_MAX);
}
