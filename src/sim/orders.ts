import { applyBagListOrder, type BagListOrder } from './bags';
import { applyExpeditionOrder } from './expeditions';
import { isEmpty, type ItemKind } from './items';
import { resolveDecision } from './events/resolve';
import { cancelBlueprint, markTree, placeBlueprint } from './build';
import { BILL_DEFAULT_TARGET, RECIPES } from './balance';
import { applyDraftOrder } from './draft';
import { setMedical } from './jobs/medical';
import { applyOutfitOrder } from './outfits';
import type {
  MapSide,
  BagKind,
  Bill,
  BuildKind,
  Container,
  GarmentKind,
  RecipeId,
  Stance,
  WorkType,
  World,
} from './types';

/** Lo que pide el jugador. La interfaz solo cambia el mundo mediante órdenes. */
export type Order =
  | { type: 'designateHouse'; houseId: number; on: boolean }
  | { type: 'designateContainer'; containerId: number; on: boolean }
  | { type: 'setWork'; survivorId: number; work: WorkType; enabled: boolean }
  /** Prioridad de un trabajo, de 1 (lo primero) a 4 (H4d). */
  | { type: 'setPriority'; survivorId: number; work: WorkType; priority: number }
  /** Respuesta a una decisión (spec H3c §4): 0 es la primera opción. */
  | { type: 'decide'; decisionId: number; option: 0 | 1 | 2 }
  // Talar y construir (H4a)
  | { type: 'markTree'; x: number; y: number; on: boolean }
  | { type: 'placeBlueprint'; kind: BuildKind; x: number; y: number }
  | { type: 'cancelBlueprint'; id: number }
  // Zombis (H4b)
  | { type: 'lockWeapon'; survivorId: number; locked: boolean }
  | { type: 'setStance'; survivorId: number; stance: Stance }
  // Pedidos de Fabricar (H4d)
  | { type: 'addBill'; recipe: RecipeId }
  | { type: 'removeBill'; billId: number }
  | { type: 'setBill'; billId: number; mode?: Bill['mode']; target?: number }
  /** Sube (-1) o baja (+1) un puesto en la lista. */
  | { type: 'moveBill'; billId: number; dir: -1 | 1 }
  // Modo combate (H4e §3.1)
  | { type: 'draft'; survivorIds: number[]; on: boolean }
  | { type: 'draftMove'; survivorIds: number[]; x: number; y: number }
  | { type: 'draftAttack'; survivorIds: number[]; zombieId: number }
  | { type: 'draftRescue'; survivorId: number; downedId: number }
  // Heridas (H5): dar un analgésico; marcar o desmarcar una cama de hospital.
  | { type: 'givePainkiller'; survivorId: number }
  | { type: 'setMedical'; bedId: number; on: boolean }
  // Atuendos (H5b §4)
  | { type: 'addOutfit' }
  | { type: 'renameOutfit'; outfitId: number; name: string }
  | { type: 'deleteOutfit'; outfitId: number }
  | { type: 'setOutfitGarment'; outfitId: number; garment: GarmentKind; on: boolean }
  | { type: 'setOutfitDead'; outfitId: number; on: boolean }
  | { type: 'setOutfit'; survivorId: number; outfitId: number }
  | { type: 'setOutfitBag'; outfitId: number; bag: BagKind; on: boolean }
  | { type: 'setOutfitHandBag'; outfitId: number; on: boolean }
  // Listas de las bolsas y «Llevar siempre» (H5b2 §3)
  | BagListOrder
  // Expediciones (H5c1 §4)
  | {
      type: 'sendExpedition';
      siteId: number;
      survivorIds: number[];
      items: Partial<Record<ItemKind, number>>;
    }
  | { type: 'returnHome'; siteId: number }
  | { type: 'explore'; side: MapSide; survivorIds: number[] };

/** Encola una orden; se aplica al principio del siguiente tick. */
export function issue(w: World, order: Order): void {
  w.orders.push(order);
}

/** Si un contenedor puede marcarse (no está registrado y vacío). */
export function markable(c: Container): boolean {
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

type BillOrder = Extract<Order, { type: 'addBill' | 'removeBill' | 'setBill' | 'moveBill' }>;

const isBillOrder = (o: Order): o is BillOrder =>
  o.type === 'addBill' || o.type === 'removeBill' || o.type === 'setBill' || o.type === 'moveBill';

/** Aplica una orden de pedidos a la lista (la del mundo o una copia). */
function applyBillOrder(w: { bills: Bill[]; nextBillId: number }, o: BillOrder): void {
  switch (o.type) {
    case 'addBill':
      w.bills.push({
        id: w.nextBillId++,
        recipe: o.recipe,
        mode: RECIPES[o.recipe].piece ? 'always' : 'until', // H5b: sobre prendas, "siempre que haya"
        target: BILL_DEFAULT_TARGET,
        done: 0,
      });
      break;
    case 'removeBill':
      w.bills = w.bills.filter((b) => b.id !== o.billId);
      break;
    case 'setBill': {
      const b = w.bills.find((x) => x.id === o.billId);
      if (!b) break;
      // Sobre prendas, "veces" o "siempre que haya"; lo demás, "veces" o "hasta tener" (H5b).
      const piece = RECIPES[b.recipe].piece !== undefined;
      if (o.mode && (o.mode === 'count' || (o.mode === 'always') === piece)) b.mode = o.mode;
      if (o.target !== undefined && Number.isInteger(o.target)) b.target = Math.max(1, o.target);
      break;
    }
    case 'moveBill': {
      const i = w.bills.findIndex((x) => x.id === o.billId);
      const j = i + o.dir;
      if (i < 0 || j < 0 || j >= w.bills.length) break;
      [w.bills[i], w.bills[j]] = [w.bills[j]!, w.bills[i]!];
      break;
    }
  }
}

/** Los pedidos con las órdenes pendientes ya aplicadas (copia: el mundo no cambia). */
export function effectiveBills(w: World): Bill[] {
  const copy = { bills: w.bills.map((b) => ({ ...b })), nextBillId: w.nextBillId };
  for (const o of w.orders) if (isBillOrder(o)) applyBillOrder(copy, o);
  return copy.bills;
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
      case 'addBill':
      case 'removeBill':
      case 'setBill':
      case 'moveBill':
        applyBillOrder(w, o);
        break;
      case 'setPriority': {
        const s = w.survivors.find((x) => x.id === o.survivorId);
        if (s && Number.isInteger(o.priority) && o.priority >= 1 && o.priority <= 4)
          s.priorities[o.work] = o.priority;
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
      case 'setStance': {
        const s = w.survivors.find((x) => x.id === o.survivorId);
        if (s) s.stance = o.stance;
        break;
      }
      case 'lockWeapon': {
        const s = w.survivors.find((x) => x.id === o.survivorId);
        if (s) s.weaponLocked = o.locked;
        break;
      }
      case 'draft':
      case 'draftMove':
      case 'draftAttack':
      case 'draftRescue':
        applyDraftOrder(w, o);
        break;
      case 'givePainkiller': {
        const s = w.survivors.find((x) => x.id === o.survivorId);
        if (s && w.storage.items.painkillers > 0) s.painkillerWanted = true;
        break;
      }
      case 'setMedical':
        setMedical(w, o.bedId, o.on);
        break;
      case 'addOutfit':
      case 'renameOutfit':
      case 'deleteOutfit':
      case 'setOutfitGarment':
      case 'setOutfitDead':
      case 'setOutfit':
      case 'setOutfitBag':
      case 'setOutfitHandBag': {
        // Los de los sitios y de viaje (H5c1), por si se borra un atuendo que llevan.
        const away = [
          ...w.siteMaps.flatMap((m) => m.world.survivors),
          ...w.common.expedition.travels.flatMap((t) => t.members),
        ];
        applyOutfitOrder({ common: w.common, survivors: w.survivors, away }, o);
        break;
      }
      case 'setBagList':
      case 'setKeep':
      case 'pinBag':
        applyBagListOrder(w, o);
        break;
      case 'sendExpedition':
      case 'returnHome':
      case 'explore':
        applyExpeditionOrder(w, o);
        break;
    }
  }
  w.orders = [];
}
