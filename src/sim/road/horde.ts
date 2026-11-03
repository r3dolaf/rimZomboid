// Una horda en el camino (spec H5c3 §2): el grupo se para ante el hexágono siguiente y espera la
// respuesta; rodear (sin pasar por la horda ni sus vecinos) o atravesarla.
import { HEX_HOURS, ROAD_DECISION_HOURS, ROAD_HORDE, TICKS_PER_HOUR } from '../balance';
import { hexesWithin } from '../atlas/hex';
import { findRoute, hexHours } from '../atlas/route';
import { addDecision } from '../decisions';
import { logEvent } from '../log';
import { nextInt } from '../rng';
import type { Decision, Travel, World } from '../types';
import { roadZombies } from './events';

/** Hay una horda en el hexágono siguiente: una decisión para la base, y el grupo espera. */
export function startHorde(base: World, t: Travel): void {
  const ahead = t.path[t.at + 1];
  if (ahead === undefined || t.waiting !== undefined) return;
  const d = addDecision(
    base,
    'horde',
    t.members.map((s) => s.id),
    { travelId: t.id, hex: ahead },
    ROAD_DECISION_HOURS * TICKS_PER_HOUR,
  );
  t.waiting = d.id;
}

/** Las paradas del jugador que aún no han pasado. */
function pendingStops(t: Travel): number[] {
  let j = 0;
  for (let i = 0; i <= t.at && j < t.waypoints.length; i++) if (t.path[i] === t.waypoints[j]) j++;
  return t.waypoints.slice(j);
}

/** Rehacen la ruta sin pasar por `hex` ni sus vecinos (con las paradas que queden, si se puede). */
function around(base: World, t: Travel, hex: number): boolean {
  const { atlas } = base.common;
  const here = t.path[t.at]!;
  const blocked = new Set(hexesWithin(atlas, hex, 1));
  blocked.delete(here);
  if (blocked.has(t.target)) return false;
  const stops = pendingStops(t).filter((i) => !blocked.has(i));
  let waypoints = stops;
  let path = findRoute(atlas, here, t.target, stops, blocked);
  if (!path && stops.length > 0) {
    waypoints = [];
    path = findRoute(atlas, here, t.target, [], blocked);
  }
  if (!path) return false;
  t.path = path;
  t.at = 0;
  t.waypoints = waypoints;
  const first = path[1];
  const h = first === undefined ? 0 : hexHours(atlas, first);
  t.hoursLeft = Number.isFinite(h) ? h : HEX_HOURS.field;
  return true;
}

/** La respuesta: 0 rodear (si no se puede, se atraviesa), 1 atravesar. */
export function resolveHorde(base: World, d: Decision, option: 0 | 1): void {
  const t = base.common.expedition.travels.find((x) => x.id === d.travelId);
  if (!t || t.waiting !== d.id) return;
  t.waiting = undefined;
  const hex = d.hex ?? t.path[t.at]!;
  if (option === 0 && around(base, t, hex)) {
    logEvent(base, { kind: 'roadHorde', names: t.members.map((s) => s.name), around: true });
    return;
  }
  const rng = base.common.expedition.rng;
  roadZombies(base, t, hex, nextInt(rng, ROAD_HORDE[0], ROAD_HORDE[1]), true);
}
