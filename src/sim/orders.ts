import { isEmpty } from './items';
import { resolveDecision } from './events/resolve';
import { cancelBlueprint, markTree, placeBlueprint } from './build';
import type { BuildKind, Container, WorkType, World } from './types';

/** Lo que pide el jugador. La interfaz solo cambia el mundo mediante órdenes. */
export type Order =
  | { type: 'designateHouse'; houseId: number; on: boolean }
  | { type: 'designateContainer'; containerId: number; on: boolean }
  | { type: 'setWork'; survivorId: number; work: WorkType; enabled: boolean }
  /** Respuesta a una decisión (spec H3c §4): 0 es la primera opción. */
  | { type: 'decide'; decisionId: number; option: 0 | 1 }
  // Talar y construir (H4a)
  | { type: 'markTree'; x: number; y: number; on: boolean }
  | { type: 'placeBlueprint'; kind: BuildKind; x: number; y: number }
  | { type: 'cancelBlueprint'; id: number };

/** Encola una orden; se aplica al principio del siguiente tick. */
export function issue(w: World, order: Order): void {
  w.orders.push(order);
}

/** Si un contenedor puede marcarse (no está registrado y vacío). */
function markable(c: Container): boolean {
  return !(c.searched && isEmpty(c.items));
}

/**
 * Marca efectiva de un contenedor: la actual con las órdenes pendientes ya aplicadas.
 * Sirve para que la interfaz responda al momento aunque el juego esté en pausa.
 */
export function effectiveDesignated(w: World, c: Container): boolean {
  let on = c.designated;
  for (const o of w.orders) {
    if (o.type === 'designateHouse' && o.houseId === c.houseId) on = o.on && markable(c);
    if (o.type === 'designateContainer' && o.containerId === c.id) on = o.on && markable(c);
  }
  return on;
}

/** ¿Tiene la casa algún contenedor marcado (contando órdenes pendientes)? */
export function houseMarked(w: World, houseId: number): boolean {
  return w.containers.some((c) => c.houseId === houseId && effectiveDesignated(w, c));
}

export function ordersSystem(w: World): void {
  for (const o of w.orders) {
    switch (o.type) {
      case 'designateHouse':
        for (const c of w.containers)
          if (c.houseId === o.houseId) c.designated = o.on && markable(c);
        break;
      case 'designateContainer': {
        const c = w.containers.find((x) => x.id === o.containerId);
        if (c) c.designated = o.on && markable(c);
        break;
      }
      case 'setWork': {
        const s = w.survivors.find((x) => x.id === o.survivorId);
        if (s) s.work[o.work] = o.enabled;
        break;
      }
      case 'decide':
        resolveDecision(w, o.decisionId, o.option);
        break;
      case 'markTree':
        markTree(w, o.x, o.y, o.on);
        break;
      case 'placeBlueprint':
        placeBlueprint(w, o.kind, o.x, o.y);
        break;
      case 'cancelBlueprint':
        cancelBlueprint(w, o.id);
        break;
    }
  }
  w.orders = [];
}
