import { LOG_MAX } from './balance';
import type { Inventory } from './items';
import type { BuildKind, SkillId, World } from './types';

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
  | { kind: 'strangerArrived'; names: string[] }
  | { kind: 'strangerAccepted'; names: string[] }
  | { kind: 'strangerRejected'; names: string[] }
  | { kind: 'strangerLeft'; names: string[] }
  // Sucesos del narrador (H3c)
  | { kind: 'theft'; suspectId: number; cans: number }
  | { kind: 'theftPunished'; suspectId: number; guilty: boolean }
  | { kind: 'theftIgnored'; suspectId: number }
  | { kind: 'jealousy'; survivorId: number; otherId: number; partnerId: number }
  | { kind: 'clash'; survivorId: number; otherId: number }
  | { kind: 'grief'; survivorId: number }
  | { kind: 'foodFight' }
  | { kind: 'gossip'; survivorId: number; listenerId: number; otherId: number; found: boolean }
  /** `arguedIds`: los dos que acabaron discutiendo, o `null` si salió bien. */
  | { kind: 'storyNight'; arguedIds: [number, number] | null }
  | { kind: 'birthday'; survivorId: number }
  | { kind: 'birthdayParty'; survivorId: number }
  | { kind: 'birthdayRuined'; survivorId: number; otherId: number }
  | { kind: 'birthdaySkipped'; survivorId: number }
  | { kind: 'cache'; survivorId: number; houseId: number; cans: number }
  | { kind: 'storm' }
  | { kind: 'flu'; survivorId: number }
  | { kind: 'fluRest'; survivorId: number }
  | { kind: 'fluWork'; survivorId: number }
  | { kind: 'fluOver'; survivorId: number }
  | { kind: 'built'; what: BuildKind }
  // Zombis (H4b)
  | { kind: 'broken'; what: 'door' | 'window' | 'wall'; x: number; y: number; inBase: boolean }
  | { kind: 'downed'; survivorId: number }
  | { kind: 'gotUp'; survivorId: number }
  | { kind: 'zombieKilled'; survivorId: number }
  | { kind: 'fled'; survivorId: number }
  // Habilidades (H4c)
  | { kind: 'skillUp'; survivorId: number; skill: SkillId; level: number }
  /** El primer zombi que entra en la base (x, y: por dónde). */
  | { kind: 'zombiesInBase'; x: number; y: number }
  /** El primer zombi que se ve cerca de la base ese día. */
  | { kind: 'zombieSighted'; x: number; y: number };

export type LogEntry = LogEvent & { tick: number };

export function logEvent(w: World, e: LogEvent): void {
  w.log.push({ tick: w.tick, ...e });
  if (w.log.length > LOG_MAX) w.log.splice(0, w.log.length - LOG_MAX);
}
