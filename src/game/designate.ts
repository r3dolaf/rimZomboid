// Herramienta Saquear: alternar marcas teniendo en cuenta las órdenes aún pendientes
// (con el juego en pausa, la orden no se aplica hasta el siguiente tick).
import { effectiveDesignated, houseMarked, issue } from '../sim/orders';
import type { World } from '../sim/types';

export function toggleHouse(w: World, houseId: number): void {
  issue(w, { type: 'designateHouse', houseId, on: !houseMarked(w, houseId) });
}

export function toggleContainer(w: World, containerId: number): void {
  const c = w.containers.find((x) => x.id === containerId);
  if (c) issue(w, { type: 'designateContainer', containerId, on: !effectiveDesignated(w, c) });
}
