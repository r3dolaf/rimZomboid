// C3: la crónica: los momentos clave de la partida, apuntados aparte del registro (que solo guarda
// los últimos LOG_MAX), para la pantalla final y para compartir.
import type { LogEntry, LogEvent } from './log';

/** Lo que se apunta siempre. */
const ALWAYS: ReadonlySet<LogEvent['kind']> = new Set([
  'died',
  'strangerAccepted',
  'roadJoined',
  'couple',
  'breakup',
  'siegeArrived',
  'siegeRepelled',
  'amputated',
  'banished',
  'killedForNothing',
  'sawTurned',
  'birthdayParty',
  'theftPunished',
  'season',
  'radioEvac',
  'heliArrived',
  'boarded',
  'heliLeft',
  'heliGone',
  'colonyFell',
  'rescueEnd',
]);

/** Lo que se apunta solo la primera vez. */
const FIRST: ReadonlySet<LogEvent['kind']> = new Set([
  'waterCut',
  'outOfFood',
  'zombiesInBase',
  'cropsFrozen',
  'radioNews',
  'fight',
  'inspired',
]);

/** ¿Va a la crónica `e`, con lo que ya hay en ella? */
export function chronicled(e: LogEvent, chronicle: readonly LogEntry[]): boolean {
  if (ALWAYS.has(e.kind)) return true;
  if (FIRST.has(e.kind)) return !chronicle.some((x) => x.kind === e.kind);
  // Las crisis fuertes (B2), no encerrarse; de lo construido, solo la radio (C1).
  if (e.kind === 'crisis')
    return e.crisis === 'binge' || e.crisis === 'rage' || e.crisis === 'flee';
  if (e.kind === 'built') return e.what === 'radio';
  return false;
}

/** La crónica de una partida guardada sin ella (de antes de C3): lo que haya en su registro. */
export function chronicleFromLog(log: readonly LogEntry[]): LogEntry[] {
  const out: LogEntry[] = [];
  for (const e of log) if (chronicled(e, out)) out.push(e);
  return out;
}
