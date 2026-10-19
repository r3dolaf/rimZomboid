import { isEmpty } from './items';
import type { World } from './types';

/** Lo que pide el jugador. La interfaz solo cambia el mundo mediante órdenes. */
export type Order =
  | { type: 'designateHouse'; houseId: number; on: boolean }
  | { type: 'designateContainer'; containerId: number; on: boolean }
  | { type: 'setWork'; survivorId: number; work: 'loot'; enabled: boolean };

/** Encola una orden; se aplica al principio del siguiente tick. */
export function issue(w: World, order: Order): void {
  w.orders.push(order);
}

export function ordersSystem(w: World): void {
  for (const o of w.orders) {
    switch (o.type) {
      case 'designateHouse':
        for (const c of w.containers)
          if (c.houseId === o.houseId) c.designated = o.on && !(c.searched && isEmpty(c.items));
        break;
      case 'designateContainer': {
        const c = w.containers.find((x) => x.id === o.containerId);
        if (c) c.designated = o.on && !(c.searched && isEmpty(c.items));
        break;
      }
      case 'setWork': {
        const s = w.survivors.find((x) => x.id === o.survivorId);
        if (s) s.work[o.work] = o.enabled;
        break;
      }
    }
  }
  w.orders = [];
}
