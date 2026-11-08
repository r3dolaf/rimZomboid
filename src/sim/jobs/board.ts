// Correr al helicóptero (spec C1 §3): con el helicóptero posado en el mapa, lo primero de todo.
import { inCrisis } from '../consoling';
import { heliZone, inZone, zoneTile } from '../evac';
import { contains } from '../geom';
import type { Action, Survivor, World } from '../types';
import { rescueOrder, rescueTargetId } from './heal';

/**
 * Con el helicóptero posado en este mapa, a la zona de aterrizaje (salvo en crisis); si hay un
 * derribado fuera de ella y nadie va a por él, llevarlo en brazos. `undefined`: no hay helicóptero
 * (decide el cerebro como siempre); `null`: sigue con lo que hace.
 */
export function boardDecision(s: Survivor, w: World): Action | null | undefined {
  const zone = heliZone(w);
  if (!zone || inCrisis(s)) return undefined;
  if (s.carryingId !== null) return null; // lo lleva a la zona (Sanar, C1)
  const a = s.action;
  if (a.type === 'moveTo' && a.then?.type === 'rescue') return null;
  if (a.type === 'moveTo' && !a.then && contains(zone, a.target)) return null;
  const downed = w.survivors.find(
    (d) =>
      d !== s &&
      d.action.type === 'downed' &&
      !inZone(zone, d.pos) &&
      !w.survivors.some((o) => o !== s && rescueTargetId(o) === d.id),
  );
  const order = downed && rescueOrder(w, s, downed);
  if (order) return order;
  const t = zoneTile(w, zone, s.pos);
  return t ? { type: 'moveTo', target: t } : undefined;
}
