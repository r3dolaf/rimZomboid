// Alguien pide unirse por el camino (spec H5c3 §2): una persona nueva, como el desconocido de la base,
// espera junto al grupo (que no se para) a que la base conteste. Aceptar: se une al grupo (si cabe en
// la colonia); rechazar o sin respuesta: se va con lo suyo.
import { COLONY_MAX, ROAD_DECISION_HOURS, TICKS_PER_HOUR } from '../balance';
import { wornBags } from '../bags';
import { piecesGone } from '../clothes';
import { addDecision } from '../decisions';
import { logEvent } from '../log';
import { newStranger } from '../systems/strangers';
import type { Decision, Travel, World } from '../types';
import { colonySize } from './roll';

/** Alguien se acerca al grupo y pide unirse: fuera de todo mapa, junto al viaje. */
export function startJoiner(base: World, t: Travel): void {
  if (t.joiner) return;
  const taken = base.common.expedition.travels.flatMap((x) => x.members.map((s) => s.name));
  const s = newStranger(base, base.base.door, taken);
  s.pos = { x: -10, y: -10 };
  s.action = { type: 'idle', ticksLeft: 0 };
  s.path = [];
  t.joiner = s;
  addDecision(base, 'joiner', [s.id], { travelId: t.id }, ROAD_DECISION_HOURS * TICKS_PER_HOUR);
}

/** Quien pedía unirse se va con lo suyo (su ropa y sus bolsas salen de las cuentas). */
function leaves(base: World, t: Travel, full: boolean): void {
  const s = t.joiner;
  if (!s) return;
  t.joiner = undefined;
  piecesGone(base, [...s.worn, ...s.carrying.pieces, ...wornBags(s)]);
  logEvent(base, { kind: 'roadJoinerLeft', name: s.name, full });
}

/** La respuesta: 0 aceptar (si cabe), 1 rechazar. */
export function resolveJoiner(base: World, d: Decision, option: 0 | 1): void {
  const t = base.common.expedition.travels.find((x) => x.id === d.travelId);
  if (!t?.joiner || t.joiner.id !== d.survivorIds[0]) return;
  if (option === 1) return leaves(base, t, false);
  if (colonySize(base) + 1 > COLONY_MAX) return leaves(base, t, true);
  const s = t.joiner;
  t.joiner = undefined;
  logEvent(base, { kind: 'roadJoined', name: s.name, names: t.members.map((x) => x.name) });
  t.members.push(s);
}

/** El viaje se acaba (llega o se queda sin nadie): quien esperaba se va, y sus decisiones también. */
export function endRoadWaits(base: World, t: Travel): void {
  leaves(base, t, false);
  t.waiting = undefined;
  base.decisions = base.decisions.filter((d) => d.travelId !== t.id);
}
